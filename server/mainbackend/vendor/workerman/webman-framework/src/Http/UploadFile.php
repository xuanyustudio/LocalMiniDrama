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

namespace Webman\Http;

use Webman\File;
use function pathinfo;

/**
 * Class UploadFile
 * @package Webman\Http
 */
class UploadFile extends File
{
    /**
     * @var string
     */
    protected $uploadName = null;

    /**
     * @var string
     */
    protected $uploadMimeType = null;

    /**
     * @var int
     */
    protected $uploadErrorCode = null;

    /**
     * UploadFile constructor.
     *
     * @param string $fileName
     * @param string $uploadName
     * @param string $uploadMimeType
     * @param int $uploadErrorCode
     */
    public function __construct(string $fileName, string $uploadName, string $uploadMimeType, int $uploadErrorCode)
    {
        $this->uploadName = $uploadName;
        $this->uploadMimeType = $uploadMimeType;
        $this->uploadErrorCode = $uploadErrorCode;
        parent::__construct($fileName);
    }

    /**
     * GetUploadName
     * @return string
     */
    public function getUploadName(): ?string
    {
        return $this->uploadName;
    }

    /**
     * GetUploadMimeType
     * @return string
     */
    public function getUploadMimeType(): ?string
    {
        return $this->uploadMimeType;
    }

    /**
     * GetUploadExtension
     * @return string
     */
    public function getUploadExtension(): string
    {
        return pathinfo($this->uploadName, PATHINFO_EXTENSION);
    }

    /**
     * GetUploadErrorCode
     * @return int
     */
    public function getUploadErrorCode(): ?int
    {
        return $this->uploadErrorCode;
    }

    /**
     * IsValid
     * @return bool
     */
    public function isValid(): bool
    {
        return $this->uploadErrorCode === UPLOAD_ERR_OK;
    }

    /**
     * GetUploadMineType
     * @return string
     * @deprecated
     */
    public function getUploadMineType(): ?string
    {
        return $this->uploadMimeType;
    }
}
