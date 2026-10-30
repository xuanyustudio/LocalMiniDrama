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

namespace plugin\admin\app\exception;

use Throwable;
use Webman\Http\Request;
use Webman\Http\Response;

/**
 * Class Handler
 * @package support\exception
 */
class Handler extends \support\exception\Handler
{
    public function render(Request $request, Throwable $exception): Response
    {
        $code = $exception->getCode();
        $debug = $this->_debug ?? $this->debug;
        if ($request->expectsJson()) {
            $json = ['code' => $code ?: 500, 'msg' => $debug ? $exception->getMessage() : 'Server internal error', 'type' => 'failed'];
            $debug && $json['traces'] = (string)$exception;
            return new Response(200, ['Content-Type' => 'application/json'],
                \json_encode($json, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }
        $error = $debug ? \nl2br((string)$exception) : 'Server internal error';
        return new Response(500, [], $error);
    }
}
