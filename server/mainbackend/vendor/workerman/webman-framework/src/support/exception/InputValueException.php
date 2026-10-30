<?php

namespace support\exception;

use Throwable;

class InputValueException extends PageNotFoundException
{

    /**
     * @var string
     */
    protected $template = '/app/view/400';

    /**
     * InputTypeException constructor.
     * @param string $message
     * @param int $code
     * @param Throwable|null $previous
     */
    public function __construct(string $message = 'Input :parameter is invalid.', int $code = 400, ?Throwable $previous = null) {
        parent::__construct($message, $code, $previous);
    }
}