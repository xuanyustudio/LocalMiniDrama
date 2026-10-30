<?php
/**
 * This file is part of webman.
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the MIT-LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @author    walkor<walkor@workerman.net>
 * @copyright walkor<walkor@workerman.net>
 * @link      http://www.workerman.net/
 * @license   http://www.opensource.org/licenses/mit-license.php MIT License
 */

namespace Webman\Exception;

use RuntimeException;
use Throwable;
use Webman\Http\Request;
use Webman\Http\Response;
use function json_encode;

/**
 * Class BusinessException
 * @package support\exception
 */
class BusinessException extends RuntimeException
{

    /**
     * @var array
     */
    protected $data = [];

    /**
     * @var bool
     */
    protected $debug = false;

    /**
     * Render an exception into an HTTP response.
     * @param Request $request
     * @return Response|null
     */
    public function render(Request $request): ?Response
    {
        if ($request->expectsJson()) {
            $code = $this->getCode();
            $json = ['code' => $code ?: 500, 'msg' => $this->getMessage(), 'data' => $this->data];
            return new Response(200, ['Content-Type' => 'application/json'],
                json_encode($json, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }
        return new Response(200, [], $this->getMessage());
    }

    /**
     * Set data.
     * @param array|null $data
     * @return array|$this
     */
    public function data(?array $data = null): array|static
    {
        if ($data === null) {
            return $this->data;
        }
        $this->data = $data;
        return $this;
    }

    /**
     * Set debug.
     * @param bool|null $value
     * @return $this|bool
     */
    public function debug(?bool $value = null): bool|static
    {
        if ($value === null) {
            return $this->debug;
        }
        $this->debug = $value;
        return $this;
    }

    /**
     * Get data.
     * @return array
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * Translate message.
     * @param string $message
     * @param array $parameters
     * @param string|null $domain
     * @param string|null $locale
     * @return string
     */
    protected function trans(string $message, array $parameters = [], ?string $domain = null, ?string $locale = null): string
    {
        $args = [];
        foreach ($parameters as $key => $parameter) {
            $args[":$key"] = $parameter;
        }
        try {
            $message = trans($message, $args, $domain, $locale);
        } catch (Throwable $e) {
        }
        foreach ($parameters as $key => $value) {
            $message = str_replace(":$key", $value, $message);
        }
        return $message;
    }

}
