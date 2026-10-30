<?php

namespace plugin\user\app\process;

use plugin\user\app\controller\PayController;
use Workerman\Timer;

/**
 * 不依赖微信回调和客户端轮询：定时向支付渠道查未入账订单，已支付则入账。
 */
class PayReconcileProcess
{
    private bool $running = false;

    public function onWorkerStart(): void
    {
        PayController::payLog('reconcile_start', ['interval_sec' => 15, 'window_sec' => 7200]);
        Timer::add(15, function () {
            if ($this->running) {
                return;
            }
            $this->running = true;
            try {
                (new PayController())->reconcileOpenOrders();
            } catch (\Throwable $e) {
                PayController::payLog('reconcile_fail', ['error' => $e->getMessage()]);
            } finally {
                $this->running = false;
            }
        });
    }
}
