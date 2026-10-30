<?php

namespace tests;

use PHPUnit\Framework\TestCase;
use Workerman\Coroutine\Parallel;
use Workerman\Coroutine;
use Workerman\Timer;

/**
 * Test cases for the Workerman\Coroutine\Parallel class.
 */
class ParallelTest extends TestCase
{
    /**
     * Test that callables are added and executed, and results are collected properly.
     */
    public function testAddAndWait()
    {
        $parallel = new Parallel();

        $parallel->add(function () {
            // Simulate some work.
            Timer::sleep(0.01);
            return 1;
        }, 'task1');

        $parallel->add(function () {
            // Simulate some work.
            Timer::sleep(0.005);
            return 2;
        }, 'task2');

        $results = $parallel->wait();

        $this->assertEquals(['task1' => 1, 'task2' => 2], $results);
    }

    /**
     * Test that exceptions thrown in callables are caught and can be retrieved.
     */
    public function testExceptions()
    {
        $parallel = new Parallel();

        $parallel->add(function () {
            throw new \Exception('Test exception');
        }, 'task_with_exception');

        $parallel->add(function () {
            return 'normal result';
        }, 'normal_task');

        $results = $parallel->wait();
        $exceptions = $parallel->getExceptions();

        // Check that the normal task result is present.
        $this->assertEquals(['normal_task' => 'normal result'], $results);

        // Check that the exception is captured for the failing task.
        $this->assertArrayHasKey('task_with_exception', $exceptions);
        $this->assertInstanceOf(\Exception::class, $exceptions['task_with_exception']);
        $this->assertEquals('Test exception', $exceptions['task_with_exception']->getMessage());
    }

    /**
     * Test concurrency control by limiting the number of concurrent tasks.
     */
    public function testConcurrencyLimit()
    {
        $concurrentLimit = 2;
        $parallel = new Parallel($concurrentLimit);

        $startTimes = [];
        $endTimes = [];

        for ($i = 0; $i < 5; $i++) {
            $parallel->add(function () use (&$startTimes, &$endTimes, $i) {
                $startTimes[$i] = microtime(true);
                // Simulate some work.
                Timer::sleep(0.1); // 100 milliseconds
                $endTimes[$i] = microtime(true);
                return $i;
            }, "task{$i}");
        }

        $parallel->wait();

        // Since we limited concurrency to 2, tasks should finish in batches.
        // We'll check that at no point more than $concurrentLimit tasks were running simultaneously.

        // Collect start and end times into an array of intervals.
        $intervals = [];
        for ($i = 0; $i < 5; $i++) {
            $intervals[] = ['start' => $startTimes[$i], 'end' => $endTimes[$i]];
        }

        // Check the maximum number of overlapping intervals does not exceed the concurrency limit.
        $maxConcurrent = $this->getMaxConcurrentIntervals($intervals);

        $this->assertLessThanOrEqual($concurrentLimit, $maxConcurrent);
    }

    /**
     * Helper function to determine the maximum number of overlapping intervals.
     *
     * @param array $intervals
     * @return int
     */
    private function getMaxConcurrentIntervals(array $intervals)
    {
        $events = [];
        foreach ($intervals as $interval) {
            $events[] = ['time' => $interval['start'], 'type' => 'start'];
            $events[] = ['time' => $interval['end'], 'type' => 'end'];
        }

        // Sort events by time, 'start' before 'end' if times are equal.
        usort($events, function ($a, $b) {
            if ($a['time'] == $b['time']) {
                return $a['type'] === 'start' ? -1 : 1;
            }
            return $a['time'] < $b['time'] ? -1 : 1;
        });

        $maxConcurrent = 0;
        $currentConcurrent = 0;

        foreach ($events as $event) {
            if ($event['type'] === 'start') {
                $currentConcurrent++;
                if ($currentConcurrent > $maxConcurrent) {
                    $maxConcurrent = $currentConcurrent;
                }
            } else {
                $currentConcurrent--;
            }
        }

        return $maxConcurrent;
    }

    /**
     * Test that callables are executed in parallel when no concurrency limit is set.
     */
    public function testParallelExecutionWithoutConcurrencyLimit()
    {
        $parallel = new Parallel();

        $startTimes = [];
        $endTimes = [];

        $parallel->add(function () use (&$startTimes, &$endTimes) {
            $startTimes[] = microtime(true);
            Timer::sleep(0.1); // 100 milliseconds
            $endTimes[] = microtime(true);
            return 'task1';
        }, 'task1');

        $parallel->add(function () use (&$startTimes, &$endTimes) {
            $startTimes[] = microtime(true);
            Timer::sleep(0.1);// 100 milliseconds
            $endTimes[] = microtime(true);
            return 'task2';
        }, 'task2');

        $parallel->wait();

        // Calculate total elapsed time.
        $totalTime = max($endTimes) - min($startTimes);

        // The total time should be approximately the duration of one task, not the sum of both.
        $this->assertLessThan(0.2, $totalTime);
    }

    /**
     * Test adding callables without specifying keys and ensure results are correctly indexed.
     */
    public function testAddWithoutKeys()
    {
        $parallel = new Parallel();

        $parallel->add(function () {
            return 'result1';
        });

        $parallel->add(function () {
            return 'result2';
        });

        $results = $parallel->wait();

        // Since no keys were specified, indices should be 0 and 1.
        $this->assertEquals(['result1', 'result2'], $results);
    }

    /**
     * Test that the Parallel class can handle a large number of tasks.
     */
    public function testLargeNumberOfTasks()
    {
        $parallel = new Parallel();

        $taskCount = 100;
        for ($i = 0; $i < $taskCount; $i++) {
            $parallel->add(function () use ($i) {
                return $i * $i;
            }, "task{$i}");
        }

        $results = $parallel->wait();

        // Verify that all tasks have been completed and results are correct.
        for ($i = 0; $i < $taskCount; $i++) {
            $this->assertEquals($i * $i, $results["task{$i}"]);
        }
    }

    /**
     * Test that adding a non-callable throws a TypeError.
     */
    public function testAddNonCallable()
    {
        $this->expectException(\TypeError::class);

        $parallel = new Parallel();
        $parallel->add('not a callable');
    }

    /**
     * Test that the wait method can be called multiple times safely.
     */
    public function testMultipleWaitCalls()
    {
        $parallel = new Parallel();

        $parallel->add(function () {
            return 'first call';
        }, 'task1');

        $resultsFirst = $parallel->wait();

        $this->assertEquals(['task1' => 'first call'], $resultsFirst);

        // Add another task after first wait.
        $parallel->add(function () {
            return 'second call';
        }, 'task2');

        $resultsSecond = $parallel->wait();

        // Since the callbacks array is not cleared after wait, results should include both tasks.
        $this->assertEquals(['task1' => 'first call', 'task2' => 'second call'], $resultsSecond);
    }

    /**
     * Test that the class properly handles empty tasks (no callables added).
     */
    public function testNoTasks()
    {
        $parallel = new Parallel();

        $results = $parallel->wait();

        $this->assertEmpty($results);
    }

    /**
     * Test that the class handles tasks that return null.
     */
    public function testTasksReturningNull()
    {
        $parallel = new Parallel();

        $parallel->add(function () {
            // No return statement, implicitly returns null.
        }, 'nullTask');

        $results = $parallel->wait();

        $this->assertArrayHasKey('nullTask', $results);
        $this->assertNull($results['nullTask']);
    }

    /**
     * Test defer can be used in tasks.
     */
    public function testWithDefer()
    {
        $parallel = new Parallel();
        $results = [];
        $parallel->add(function () use (&$results) {
            Coroutine::defer(function () use (&$results) {
                $results[] = 'defer1';
            });
        });
        $parallel->wait();
        $this->assertEquals(['defer1'], $results);
    }

}

