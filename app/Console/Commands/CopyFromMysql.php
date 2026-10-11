<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Temporary: one-off copy of the old MySQL/MariaDB data into a freshly
 * migrated Postgres database. Remove once production has moved.
 */
class CopyFromMysql extends Command
{
    protected $signature = 'db:copy-from-mysql
        {--host=127.0.0.1} {--port=3306} {--database=db} {--username=db} {--password=db}
        {--force : Skip the confirmation before emptying the target tables}';

    protected $description = 'Copy all rows from a MySQL/MariaDB database into the (migrated) Postgres default connection';

    // Transient state; nothing worth carrying across.
    private const SKIP = ['migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'password_reset_tokens'];

    public function handle(): int
    {
        $target = DB::connection();
        if ($target->getDriverName() !== 'pgsql') {
            $this->error('The default connection must be pgsql.');

            return self::FAILURE;
        }

        config(['database.connections.mysql_source' => array_merge(config('database.connections.mariadb'), [
            'host' => $this->option('host'),
            'port' => $this->option('port'),
            'database' => $this->option('database'),
            'username' => $this->option('username'),
            'password' => $this->option('password'),
            'url' => null,
        ])]);
        $source = DB::connection('mysql_source');

        // Same migrations on both sides means the same columns, so rows map 1:1.
        $from = $source->table('migrations')->pluck('migration');
        $to = $target->table('migrations')->pluck('migration');
        $mismatch = $from->diff($to)->merge($to->diff($from));
        if ($mismatch->isNotEmpty()) {
            $this->error('Source and target have run different migrations: '.$mismatch->implode(', '));

            return self::FAILURE;
        }

        $tables = $this->tablesInInsertOrder();

        if (! $this->option('force') && ! $this->confirm('Empty '.count($tables).' Postgres tables and copy into them?')) {
            return self::FAILURE;
        }

        $target->transaction(function () use ($source, $target, $tables) {
            $target->statement('TRUNCATE '.implode(', ', array_map(fn ($t) => "\"{$t}\"", $tables)).' RESTART IDENTITY CASCADE');

            foreach ($tables as $table) {
                // MySQL hands booleans back as 0/1, which Postgres won't take.
                $booleans = $target->table('information_schema.columns')
                    ->where('table_schema', 'public')->where('table_name', $table)->where('data_type', 'boolean')
                    ->pluck('column_name')->all();

                $query = $source->table($table);
                if ($source->getSchemaBuilder()->hasColumn($table, 'id')) {
                    $query->orderBy('id');
                }

                $query->cursor()
                    ->map(function ($row) use ($booleans) {
                        $row = (array) $row;
                        foreach ($booleans as $column) {
                            $row[$column] = $row[$column] === null ? null : (bool) $row[$column];
                        }

                        return $row;
                    })
                    ->chunk(500)
                    ->each(fn ($rows) => $target->table($table)->insert($rows->values()->all()));

                // Inserted explicit ids, so the sequence still sits at 1.
                $sequence = $target->scalar('select pg_get_serial_sequence(?, ?)', [$table, 'id']);
                if ($sequence) {
                    $target->statement("select setval(?, coalesce((select max(id) from \"{$table}\"), 0) + 1, false)", [$sequence]);
                }
            }
        });

        $this->table(['Table', 'MySQL', 'Postgres'], array_map(function ($table) use ($source, $target) {
            $from = $source->table($table)->count();
            $to = $target->table($table)->count();

            return [$table, $from, $from === $to ? $to : "<error>{$to}</error>"];
        }, $tables));

        return self::SUCCESS;
    }

    /**
     * Postgres tables, parents before children, so foreign keys hold on insert.
     */
    private function tablesInInsertOrder(): array
    {
        $target = DB::connection();

        $tables = $target->table('pg_tables')->where('schemaname', 'public')
            ->whereNotIn('tablename', self::SKIP)->orderBy('tablename')->pluck('tablename')->all();

        $parents = [];
        foreach ($target->select("
            select conrelid::regclass::text as child, confrelid::regclass::text as parent
            from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace
        ") as $fk) {
            if ($fk->child !== $fk->parent) {
                $parents[trim($fk->child, '"')][] = trim($fk->parent, '"');
            }
        }

        $ordered = [];
        $visit = function (string $table) use (&$visit, &$ordered, $parents, $tables) {
            if (in_array($table, $ordered, true) || ! in_array($table, $tables, true)) {
                return;
            }
            foreach ($parents[$table] ?? [] as $parent) {
                $visit($parent);
            }
            $ordered[] = $table;
        };
        array_walk($tables, fn ($table) => $visit($table));

        return $ordered;
    }
}
