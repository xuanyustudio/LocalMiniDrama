<?php
/**
 * This file is part of workerman.
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

declare(strict_types=1);

namespace Workerman\Coroutine\Channel;

use Swow\Channel;
use Throwable;

/**
 * Class Swow
 */
class Swow implements ChannelInterface
{

    /**
     * @var Channel
     */
    protected Channel $channel;

    /**
     * Constructor.
     *
     * @param int $capacity
     */
    public function __construct(protected int $capacity = 1)
    {
        $this->channel = new Channel($capacity);
    }

    /**
     * @inheritDoc
     */
    public function push(mixed $data, float $timeout = -1): bool
    {
        try {
            $this->channel->push($data, $timeout == -1 ? -1 : (int)($timeout * 1000));
        } catch (Throwable) {
            return false;
        }
        return true;
    }

    /**
     * @inheritDoc
     */
    public function pop(float $timeout = -1): mixed
    {
        try {
            return $this->channel->pop($timeout == -1 ? -1 : (int)($timeout * 1000));
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @inheritDoc
     */
    public function length(): int
    {
        return $this->channel->getLength();
    }

    /**
     * @inheritDoc
     */
    public function getCapacity(): int
    {
        return $this->channel->getCapacity();
    }

    /**
     * @inheritDoc
     */
    public function hasConsumers(): bool
    {
        return $this->channel->hasConsumers();
    }

    /**
     * @inheritDoc
     */
    public function hasProducers(): bool
    {
        return $this->channel->hasProducers();
    }

    /**
     * @inheritDoc
     */
    public function close(): void
    {
        $this->channel->close();
    }

}
