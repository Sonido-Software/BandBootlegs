<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApplyLabelsToEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('track')) ?? false;
    }

    public function rules(): array
    {
        $channels = (int) $this->route('track')->channels_count;

        return [
            // present (not required) so an all-blank set can clear names event-wide.
            'channel_labels' => ['present', 'array', 'max:'.max($channels, 1)],
            'channel_labels.*' => ['nullable', 'string', 'max:60'],
        ];
    }
}
