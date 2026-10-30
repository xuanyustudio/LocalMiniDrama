<?php

namespace Webman\Console\Commands;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use ZipArchive;

#[AsCommand('build:bin', 'build bin')]
class BuildBinCommand extends BuildPharCommand
{
    protected string $binFileName;

    public function __construct()
    {
        parent::__construct();
        $this->binFileName = config('plugin.webman.console.app.bin_filename', 'webman.bin');
    }

    /**
     * @return void
     */
    protected function configure()
    {
        $this->addArgument('version', InputArgument::OPTIONAL, $this->msg('arg_version'));
    }

    /**
     * @param InputInterface $input
     * @param OutputInterface $output
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->checkEnv();

        $output->writeln($this->msg('phar_packing'));

        $version = $input->getArgument('version');
        if (!$version) {
            $version = (float)PHP_VERSION;
        }
        $version = max($version, 8.1);
        $supportZip = class_exists(ZipArchive::class);
        $microZipFileName = $supportZip ? "php$version.micro.sfx.zip" : "php$version.micro.sfx";
        $customIni = config('plugin.webman.console.app.custom_ini', '');

        $binFile = $this->buildDir. DIRECTORY_SEPARATOR . $this->binFileName;
        $pharFile = $this->buildDir . DIRECTORY_SEPARATOR . $this->getPharFileName();
        $zipFile = $this->buildDir. DIRECTORY_SEPARATOR . $microZipFileName;
        $sfxFile = $this->buildDir. DIRECTORY_SEPARATOR . "php$version.micro.sfx";
        $customIniHeaderFile = $this->buildDir. DIRECTORY_SEPARATOR . "custominiheader.bin";

        // 打包
        $command = new BuildPharCommand();
        $command->execute($input, $output);

        // 下载 micro.sfx.zip
        if (!is_file($sfxFile) && !is_file($zipFile)) {
            $domain = 'download.workerman.net';
            $output->writeln($this->msg('downloading_php', ['{version}' => (string)$version]));
            if (extension_loaded('openssl')) {
                $context = stream_context_create([
                    'ssl' => [
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                    ]
                ]);
                $client = stream_socket_client("ssl://$domain:443", $context);
            } else {
                $client = stream_socket_client("tcp://$domain:80");
            }
            if (!$client) {
                $output->writeln($this->msg('download_stream_failed'));
                return self::FAILURE;
            }

            fwrite($client, "GET /php/$microZipFileName HTTP/1.1\r\nAccept: text/html\r\nHost: $domain\r\nUser-Agent: webman/console\r\n\r\n");
            $bodyLength = 0;
            $bodyBuffer = '';
            $lastPercent = 0;
            while (true) {
                $buffer = fread($client, 65535);
                if ($buffer !== false) {
                    $bodyBuffer .= $buffer;
                    if (!$bodyLength && $pos = strpos($bodyBuffer, "\r\n\r\n")) {
                        if (!preg_match('/Content-Length: (\d+)\r\n/', $bodyBuffer, $match)) {
                            $output->writeln($this->msg('download_failed', ['{message}' => "php{$version}.micro.sfx.zip: missing Content-Length"]));
                            return self::FAILURE;
                        }
                        $firstLine = substr($bodyBuffer, 9, strpos($bodyBuffer, "\r\n") - 9);
                        if (!preg_match('/200 /', $bodyBuffer)) {
                            $output->writeln($this->msg('download_failed', ['{message}' => "php{$version}.micro.sfx.zip: {$firstLine}"]));
                            return self::FAILURE;
                        }
                        $bodyLength = (int)$match[1];
                        $bodyBuffer = substr($bodyBuffer, $pos + 4);
                    }
                }
                $receiveLength = strlen($bodyBuffer);
                $percent = ceil($receiveLength * 100 / $bodyLength);
                if ($percent != $lastPercent) {
                    echo '[' . str_pad('', $percent, '=') . '>' . str_pad('', 100 - $percent) . "$percent%]";
                    echo $percent < 100 ? "\r" : "\n";
                }
                $lastPercent = $percent;
                if ($bodyLength && $receiveLength >= $bodyLength) {
                    file_put_contents($zipFile, $bodyBuffer);
                    break;
                }
                if ($buffer === false || !is_resource($client) || feof($client)) {
                    $output->writeln($this->msg('download_failed', ['{message}' => "PHP{$version}"]));
                    return self::FAILURE;
                }
            }
        } else {
            $output->writeln($this->msg('use_php', ['{version}' => (string)$version]));
        }

        // 解压
        if (!is_file($sfxFile) && $supportZip) {
            $zip = new ZipArchive;
            $zip->open($zipFile, ZipArchive::CHECKCONS);
            $zip->extractTo($this->buildDir);
        }

        // 生成二进制文件
        file_put_contents($binFile, file_get_contents($sfxFile));
        // 自定义INI
        if (!empty($customIni)) {
            if (file_exists($customIniHeaderFile)) {
                unlink($customIniHeaderFile);
            }
            $f = fopen($customIniHeaderFile, 'wb');
            fwrite($f, "\xfd\xf6\x69\xe6");
            fwrite($f, pack('N', strlen($customIni)));
            fwrite($f, $customIni);
            fclose($f);
            file_put_contents($binFile, file_get_contents($customIniHeaderFile),FILE_APPEND);
            unlink($customIniHeaderFile);
        }
        file_put_contents($binFile, file_get_contents($pharFile), FILE_APPEND);

        // 添加执行权限
        chmod($binFile, 0755);

        $output->writeln($this->msg('saved_bin', ['{name}' => $this->binFileName, '{path}' => $binFile]));

        return self::SUCCESS;
    }
}
