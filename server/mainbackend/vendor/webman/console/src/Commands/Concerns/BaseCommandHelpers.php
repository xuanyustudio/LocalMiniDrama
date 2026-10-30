<?php

namespace Webman\Console\Commands\Concerns;

use Webman\Console\Util;

/**
 * Base command helpers for common functionality across all command types
 */
trait BaseCommandHelpers
{
    /**
     * Get localized message with optional placeholder replacement
     *
     * @param array $messages Localized messages array
     * @param string $key Message key
     * @param array $replace Placeholder replacements ['{placeholder}' => 'value']
     * @return mixed String message or array if message is array type
     */
    protected function getLocalizedMessage(array $messages, string $key, array $replace = []): mixed
    {
        $text = $messages[$key] ?? $key;
        
        if (is_array($text)) {
            return $text;
        }
        
        return strtr($text, $replace);
    }
}
