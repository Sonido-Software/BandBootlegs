<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ApplyMixToEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('track')) ?? false;
    }

    public function rules(): array
    {
        return [
            'default_mix' => ['required', 'array'],
            ...UpdateTrackRequest::mixEntryRules(),
        ];
    }
}
