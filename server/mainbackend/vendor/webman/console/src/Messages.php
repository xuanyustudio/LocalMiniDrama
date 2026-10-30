<?php
namespace Webman\Console;

class Messages
{
    /**
     * Shared `plugin_path_conflict` message used by all make:* commands.
     *
     * @return array<string, string>
     */
    public static function getPluginPathConflictMessage(): array
    {
        return [
            'zh_CN' => "<error>`--path/-P` 指定的路径不在 plugin/{plugin}/ 目录下。\n同时使用 `--plugin/-p` 时，`--path/-P` 必须是 plugin/{plugin}/ 下的路径。</error>",
            'zh_TW' => "<error>`--path/-P` 指定的路徑不在 plugin/{plugin}/ 目錄下。\n同時使用 `--plugin/-p` 時，`--path/-P` 必須是 plugin/{plugin}/ 下的路徑。</error>",
            'en' => "<error>`--path/-P` is not under plugin/{plugin}/.\nWhen `--plugin/-p` is specified, `--path/-P` must be under plugin/{plugin}/.</error>",
            'ja' => "<error>`--path/-P` が plugin/{plugin}/ 配下にありません。\n`--plugin/-p` 指定時、`--path/-P` は plugin/{plugin}/ 配下のパスでなければなりません。</error>",
            'ko' => "<error>`--path/-P`가 plugin/{plugin}/ 아래에 없습니다.\n`--plugin/-p` 지정 시 `--path/-P`는 plugin/{plugin}/ 하위 경로여야 합니다.</error>",
            'fr' => "<error>`--path/-P` n'est pas sous plugin/{plugin}/.\nAvec `--plugin/-p`, `--path/-P` doit être un chemin sous plugin/{plugin}/.</error>",
            'de' => "<error>`--path/-P` liegt nicht unter plugin/{plugin}/.\nBei Angabe von `--plugin/-p` muss `--path/-P` unter plugin/{plugin}/ liegen.</error>",
            'es' => "<error>`--path/-P` no está bajo plugin/{plugin}/.\nAl usar `--plugin/-p`, `--path/-P` debe ser una ruta bajo plugin/{plugin}/.</error>",
            'pt_BR' => "<error>`--path/-P` não está em plugin/{plugin}/.\nAo usar `--plugin/-p`, `--path/-P` deve estar sob plugin/{plugin}/.</error>",
            'ru' => "<error>`--path/-P` не находится в plugin/{plugin}/.\nПри использовании `--plugin/-p` `--path/-P` должен быть путём внутри plugin/{plugin}/.</error>",
            'vi' => "<error>`--path/-P` không nằm trong plugin/{plugin}/.\nKhi dùng `--plugin/-p`, `--path/-P` phải là đường dẫn trong plugin/{plugin}/.</error>",
            'tr' => "<error>`--path/-P` plugin/{plugin}/ altında değil.\n`--plugin/-p` belirtildiğinde `--path/-P` plugin/{plugin}/ altında bir yol olmalıdır.</error>",
            'id' => "<error>`--path/-P` tidak berada di bawah plugin/{plugin}/.\nSaat `--plugin/-p` ditentukan, `--path/-P` harus di bawah plugin/{plugin}/.</error>",
            'th' => "<error>`--path/-P` ไม่อยู่ภายใต้ plugin/{plugin}/\nเมื่อระบุ `--plugin/-p` `--path/-P` ต้องเป็นเส้นทางภายใต้ plugin/{plugin}/</error>",
        ];
    }

    /**
     * Controller path validation message for make:controller.
     *
     * @return array<string, string>
     */
    public static function getPathMissingControllerMessage(): array
    {
        return [
            'zh_CN' => '<error>控制器路径必须包含 controller 或 Controller 目录。</error>',
            'zh_TW' => '<error>控制器路徑必須包含 controller 或 Controller 目錄。</error>',
            'en' => '<error>Controller path must contain a "controller" or "Controller" directory segment.</error>',
            'ja' => '<error>コントローラのパスには controller または Controller ディレクトリが含まれていなければなりません。</error>',
            'ko' => '<error>컨트롤러 경로에는 controller 또는 Controller 디렉터리가 포함되어야 합니다.</error>',
            'fr' => '<error>Le chemin du contrôleur doit contenir un répertoire "controller" ou "Controller".</error>',
            'de' => '<error>Der Controller-Pfad muss ein Verzeichnis "controller" oder "Controller" enthalten.</error>',
            'es' => '<error>La ruta del controlador debe contener un directorio "controller" o "Controller".</error>',
            'pt_BR' => '<error>O caminho do controlador deve conter um diretório "controller" ou "Controller".</error>',
            'ru' => '<error>Путь контроллера должен содержать директорию "controller" или "Controller".</error>',
            'vi' => '<error>Đường dẫn controller phải chứa thư mục "controller" hoặc "Controller".</error>',
            'tr' => '<error>Controller yolu "controller" veya "Controller" dizini içermelidir.</error>',
            'id' => '<error>Path controller harus mengandung direktori "controller" atau "Controller".</error>',
            'th' => '<error>เส้นทาง controller ต้องมีไดเรกทอรี "controller" หรือ "Controller"</error>',
        ];
    }

    public static function getAppPluginCreateHelpText(): array
    {
        return [
            'zh_CN' => "创建 App 插件（包含基础目录结构）。\n\n用法：\n  php webman app-plugin:create foo",
            'zh_TW' => "建立 App 插件（含基礎目錄結構）。\n\n用法：\n  php webman app-plugin:create foo",
            'en' => "Create an App plugin (with basic directory structure).\n\nUsage:\n  php webman app-plugin:create foo",
            'ja' => "App プラグインを作成（基本ディレクトリ構造付き）。\n\n使い方：\n  php webman app-plugin:create foo",
            'ko' => "App 플러그인 생성(기본 디렉터리 구조 포함).\n\n사용법:\n  php webman app-plugin:create foo",
            'fr' => "Créer un plugin App (avec structure de répertoires de base).\n\nUsage :\n  php webman app-plugin:create foo",
            'de' => "App-Plugin erstellen (mit grundlegender Verzeichnisstruktur).\n\nVerwendung:\n  php webman app-plugin:create foo",
            'es' => "Crear un plugin App (con estructura de directorios básica).\n\nUso:\n  php webman app-plugin:create foo",
            'pt_BR' => "Criar um plugin App (com estrutura de diretórios básica).\n\nUso:\n  php webman app-plugin:create foo",
            'ru' => "Создать App-плагин (с базовой структурой каталогов).\n\nИспользование:\n  php webman app-plugin:create foo",
            'vi' => "Tạo plugin App (có cấu trúc thư mục cơ bản).\n\nCách dùng:\n  php webman app-plugin:create foo",
            'tr' => "App eklentisi oluştur (temel dizin yapısı ile).\n\nKullanım:\n  php webman app-plugin:create foo",
            'id' => "Buat plugin App (dengan struktur direktori dasar).\n\nPenggunaan:\n  php webman app-plugin:create foo",
            'th' => "สร้างปลั๊กอิน App（พร้อมโครงสร้างโฟลเดอร์พื้นฐาน）.\n\nวิธีใช้:\n  php webman app-plugin:create foo",
        ];
    }

    public static function getAppPluginInstallHelpText(): array
    {
        return [
            'zh_CN' => "安装 App 插件（执行插件的安装脚本）。\n\n用法：\n  php webman app-plugin:install foo",
            'zh_TW' => "安裝 App 插件（執行插件的安裝腳本）。\n\n用法：\n  php webman app-plugin:install foo",
            'en' => "Install an App plugin (executes the plugin's install script).\n\nUsage:\n  php webman app-plugin:install foo",
            'ja' => "App プラグインをインストール（プラグインのインストールスクリプトを実行）。\n\n使い方：\n  php webman app-plugin:install foo",
            'ko' => "App 플러그인 설치(플러그인의 설치 스크립트 실행).\n\n사용법:\n  php webman app-plugin:install foo",
            'fr' => "Installer un plugin App (exécute le script d'installation du plugin).\n\nUsage :\n  php webman app-plugin:install foo",
            'de' => "App-Plugin installieren (führt das Installationsskript des Plugins aus).\n\nVerwendung:\n  php webman app-plugin:install foo",
            'es' => "Instalar un plugin App (ejecuta el script de instalación del plugin).\n\nUso:\n  php webman app-plugin:install foo",
            'pt_BR' => "Instalar um plugin App (executa o script de instalação do plugin).\n\nUso:\n  php webman app-plugin:install foo",
            'ru' => "Установить App-плагин (выполняет скрипт установки плагина).\n\nИспользование:\n  php webman app-plugin:install foo",
            'vi' => "Cài đặt plugin App (chạy script cài đặt của plugin).\n\nCách dùng:\n  php webman app-plugin:install foo",
            'tr' => "App eklentisini yükle (eklentinin kurulum betiğini çalıştırır).\n\nKullanım:\n  php webman app-plugin:install foo",
            'id' => "Pasang plugin App (menjalankan skrip instalasi plugin).\n\nPenggunaan:\n  php webman app-plugin:install foo",
            'th' => "ติดตั้งปลั๊กอิน App（รันสคริปต์ติดตั้งของปลั๊กอิน）.\n\nวิธีใช้:\n  php webman app-plugin:install foo",
        ];
    }

    public static function getAppPluginUninstallHelpText(): array
    {
        return [
            'zh_CN' => "卸载 App 插件（执行插件的卸载脚本）。\n\n用法：\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'zh_TW' => "卸載 App 插件（執行插件的卸載腳本）。\n\n用法：\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'en' => "Uninstall an App plugin (executes the plugin's uninstall script).\n\nUsage:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'ja' => "App プラグインをアンインストール（プラグインのアンインストールスクリプトを実行）。\n\n使い方：\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'ko' => "App 플러그인 제거(플러그인의 제거 스크립트 실행).\n\n사용법:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'fr' => "Désinstaller un plugin App (exécute le script de désinstallation du plugin).\n\nUsage :\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'de' => "App-Plugin deinstallieren (führt das Deinstallationsskript des Plugins aus).\n\nVerwendung:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'es' => "Desinstalar un plugin App (ejecuta el script de desinstalación del plugin).\n\nUso:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'pt_BR' => "Desinstalar um plugin App (executa o script de desinstalação do plugin).\n\nUso:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'ru' => "Удалить App-плагин (выполняет скрипт удаления плагина).\n\nИспользование:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'vi' => "Gỡ cài đặt plugin App (chạy script gỡ cài đặt của plugin).\n\nCách dùng:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'tr' => "App eklentisini kaldır (eklentinin kaldırma betiğini çalıştırır).\n\nKullanım:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'id' => "Uninstall plugin App (menjalankan skrip uninstall plugin).\n\nPenggunaan:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
            'th' => "ถอนการติดตั้งปลั๊กอิน App（รันสคริปต์ถอนการติดตั้ง）.\n\nวิธีใช้:\n  php webman app-plugin:uninstall foo\n  php webman app-plugin:uninstall foo --yes",
        ];
    }

    public static function getAppPluginUpdateHelpText(): array
    {
        return [
            'zh_CN' => "更新 App 插件（执行插件的更新脚本）。\n\n用法：\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'zh_TW' => "更新 App 插件（執行插件的更新腳本）。\n\n用法：\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'en' => "Update an App plugin (executes the plugin's update script).\n\nUsage:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'ja' => "App プラグインを更新（プラグインの更新スクリプトを実行）。\n\n使い方：\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'ko' => "App 플러그인 업데이트(플러그인의 업데이트 스크립트 실행).\n\n사용법:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'fr' => "Mettre à jour un plugin App (exécute le script de mise à jour du plugin).\n\nUsage :\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'de' => "App-Plugin aktualisieren (führt das Aktualisierungsskript des Plugins aus).\n\nVerwendung:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'es' => "Actualizar un plugin App (ejecuta el script de actualización del plugin).\n\nUso:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'pt_BR' => "Atualizar um plugin App (executa o script de atualização do plugin).\n\nUso:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'ru' => "Обновить App-плагин (выполняет скрипт обновления плагина).\n\nИспользование:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'vi' => "Cập nhật plugin App (chạy script cập nhật của plugin).\n\nCách dùng:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'tr' => "App eklentisini güncelle (eklentinin güncelleme betiğini çalıştırır).\n\nKullanım:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'id' => "Perbarui plugin App (menjalankan skrip pembaruan plugin).\n\nPenggunaan:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
            'th' => "อัปเดตปลั๊กอิน App（รันสคริปต์อัปเดต）.\n\nวิธีใช้:\n  php webman app-plugin:update foo\n  php webman app-plugin:update foo --from 1.0.0 --to 1.1.0",
        ];
    }

    public static function getAppPluginZipHelpText(): array
    {
        return [
            'zh_CN' => "打包 App 插件为 ZIP 格式。\n\n用法：\n  php webman app-plugin:zip foo",
            'zh_TW' => "打包 App 插件為 ZIP 格式。\n\n用法：\n  php webman app-plugin:zip foo",
            'en' => "Zip an App plugin into a ZIP file.\n\nUsage:\n  php webman app-plugin:zip foo",
            'ja' => "App プラグインを ZIP ファイルに圧縮。\n\n使い方：\n  php webman app-plugin:zip foo",
            'ko' => "App 플러그인을 ZIP 파일로 압축.\n\n사용법:\n  php webman app-plugin:zip foo",
            'fr' => "Compresser un plugin App en un fichier ZIP.\n\nUsage :\n  php webman app-plugin:zip foo",
            'de' => "App-Plugin in eine ZIP-Datei packen.\n\nVerwendung:\n  php webman app-plugin:zip foo",
            'es' => "Comprimir un plugin App en un archivo ZIP.\n\nUso:\n  php webman app-plugin:zip foo",
            'pt_BR' => "Empacotar um plugin App em um arquivo ZIP.\n\nUso:\n  php webman app-plugin:zip foo",
            'ru' => "Упаковать App-плагин в ZIP-файл.\n\nИспользование:\n  php webman app-plugin:zip foo",
            'vi' => "Đóng gói plugin App thành file ZIP.\n\nCách dùng:\n  php webman app-plugin:zip foo",
            'tr' => "App eklentisini ZIP dosyasına sıkıştır.\n\nKullanım:\n  php webman app-plugin:zip foo",
            'id' => "Bungkus plugin App ke file ZIP.\n\nPenggunaan:\n  php webman app-plugin:zip foo",
            'th' => "บีบอัดปลั๊กอิน App เป็นไฟล์ ZIP.\n\nวิธีใช้:\n  php webman app-plugin:zip foo",
        ];
    }

    public static function getAppPluginMessages(): array
    {
        $zhCn = [
            'bad_name' => "<error>插件名无效：</error> <comment>{name}</comment>\n<comment>要求</comment> 只能是 plugin/ 目录下的文件夹名，且仅允许字母数字、下划线、连字符（不能包含 / 或 \\）。",
            'plugin_not_exists' => "<error>插件不存在：</error> <comment>{path}</comment>",
            'create_title' => "<info>创建 App 插件</info> <comment>{name}</comment>",
            'install_title' => "<info>安装 App 插件</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>卸载 App 插件</info> <comment>{name}</comment>",
            'update_title' => "<info>更新 App 插件</info> <comment>{name}</comment>",
            'zip_title' => "<info>打包 App 插件</info> <comment>{name}</comment>",
            'dir_exists' => "<error>目录已存在：</error> <comment>{path}</comment>",
            'created_dir' => "<info>创建目录：</info> <comment>{path}</comment>",
            'created_file' => "<info>创建文件：</info> <comment>{path}</comment>",
            'script_missing' => "<error>未找到安装脚本：</error> <comment>{class}</comment>\n<comment>提示</comment> 如刚修改过 composer.json，请先执行：<info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>即将执行卸载脚本，可能会删除数据，是否继续？[y/N]（回车默认 N）</>\n",
            'running' => "<comment>执行</comment> {class}::{method}({args})",
            'done' => "<info>完成</info>",
            'failed' => "<error>失败：</error> <comment>{error}</comment>",
            'version_same' => "<comment>提示</comment> from/to 版本相同（{version}），若无迁移逻辑可忽略。",
            'zip_saved' => "<info>已生成：</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>无法删除旧的 zip 文件：</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>无法创建 zip 文件：</error> <comment>{path}</comment>",
            'description_name' => '插件名称',
            'description_yes' => '跳过确认',
            'description_from' => '起始版本（默认：当前版本）',
            'description_to' => '目标版本（默认：当前版本）',
            'source_not_exists' => "源目录不存在：{path}",
        ];

        $zhTw = [
            'bad_name' => "<error>插件名稱無效：</error> <comment>{name}</comment>\n<comment>要求</comment> 只能是 plugin/ 目錄下的資料夾名，且僅允許字母數字、底線、連字元（不能包含 / 或 \\）。",
            'plugin_not_exists' => "<error>插件不存在：</error> <comment>{path}</comment>",
            'create_title' => "<info>建立 App 插件</info> <comment>{name}</comment>",
            'install_title' => "<info>安裝 App 插件</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>卸載 App 插件</info> <comment>{name}</comment>",
            'update_title' => "<info>更新 App 插件</info> <comment>{name}</comment>",
            'zip_title' => "<info>打包 App 插件</info> <comment>{name}</comment>",
            'dir_exists' => "<error>目錄已存在：</error> <comment>{path}</comment>",
            'created_dir' => "<info>建立目錄：</info> <comment>{path}</comment>",
            'created_file' => "<info>建立檔案：</info> <comment>{path}</comment>",
            'script_missing' => "<error>未找到安裝腳本：</error> <comment>{class}</comment>\n<comment>提示</comment> 如剛修改過 composer.json，請先執行：<info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>即將執行卸載腳本，可能會刪除資料，是否繼續？[y/N]（Enter default: N）</>\n",
            'running' => "<comment>執行</comment> {class}::{method}({args})",
            'done' => "<info>完成</info>",
            'failed' => "<error>失敗：</error> <comment>{error}</comment>",
            'version_same' => "<comment>提示</comment> from/to 版本相同（{version}），若無遷移邏輯可忽略。",
            'zip_saved' => "<info>已產生：</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>無法刪除舊的 zip 檔案：</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>無法建立 zip 檔案：</error> <comment>{path}</comment>",
            'description_name' => '插件名稱',
            'description_yes' => '跳過確認',
            'description_from' => '起始版本（默認：當前版本）',
            'description_to' => '目標版本（默認：當前版本）',
            'source_not_exists' => "來源目錄不存在：{path}",
        ];

        $en = [
            'bad_name' => "<error>Invalid plugin name: </error> <comment>{name}</comment>\n<comment>Rules</comment> Must be a folder name under plugin/, and only allows letters/digits/underscore/hyphen (must not contain / or \\).",
            'plugin_not_exists' => "<error>Plugin not found:</error> <comment>{path}</comment>",
            'create_title' => "<info>Create App plugin</info> <comment>{name}</comment>",
            'install_title' => "<info>Install App plugin</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Uninstall App plugin</info> <comment>{name}</comment>",
            'update_title' => "<info>Update App plugin</info> <comment>{name}</comment>",
            'zip_title' => "<info>Zip App plugin</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Directory already exists:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Created directory:</info> <comment>{path}</comment>",
            'created_file' => "<info>Created file:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Install script not found:</error> <comment>{class}</comment>\n<comment>Note</comment> If you just changed composer.json, please run: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>It will execute uninstall script and may delete data. Continue? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Run</comment> {class}::{method}({args})",
            'done' => "<info>Done</info>",
            'failed' => "<error>Failed:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Note</comment> from/to versions are the same ({version}). You can ignore this if no migration is needed.",
            'zip_saved' => "<info>Generated:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Unable to delete existing zip file:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Cannot create zip file:</error> <comment>{path}</comment>",
            'description_name' => 'App plugin name',
            'description_yes' => 'Skip confirmation',
            'description_from' => 'From version (default: current version)',
            'description_to' => 'To version (default: current version)',
            'source_not_exists' => "Source directory does not exist: {path}",
        ];

        $ja = [
            'bad_name' => "<error>無効なプラグイン名：</error> <comment>{name}</comment>\n<comment>ルール</comment> plugin/ 以下のフォルダ名のみ。英数字・アンダースコア・ハイフンのみ使用可（/ または \\ は不可）。",
            'plugin_not_exists' => "<error>プラグインが見つかりません：</error> <comment>{path}</comment>",
            'create_title' => "<info>App プラグインを作成</info> <comment>{name}</comment>",
            'install_title' => "<info>App プラグインをインストール</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>App プラグインをアンインストール</info> <comment>{name}</comment>",
            'update_title' => "<info>App プラグインを更新</info> <comment>{name}</comment>",
            'zip_title' => "<info>App プラグインをZIP化</info> <comment>{name}</comment>",
            'dir_exists' => "<error>ディレクトリが既に存在します：</error> <comment>{path}</comment>",
            'created_dir' => "<info>ディレクトリを作成：</info> <comment>{path}</comment>",
            'created_file' => "<info>ファイルを作成：</info> <comment>{path}</comment>",
            'script_missing' => "<error>インストールスクリプトが見つかりません：</error> <comment>{class}</comment>\n<comment>注意</comment> composer.json を変更した場合は <info>composer dumpautoload</info> を実行してください。",
            'uninstall_confirm' => "<fg=yellow>アンインストールスクリプトを実行します。データが削除される可能性があります。続行しますか？[y/N]（Enter default: N）</>\n",
            'running' => "<comment>実行</comment> {class}::{method}({args})",
            'done' => "<info>完了</info>",
            'failed' => "<error>失敗：</error> <comment>{error}</comment>",
            'version_same' => "<comment>注意</comment> from/to のバージョンが同じです（{version}）。マイグレーションが不要な場合は無視して構いません。",
            'zip_saved' => "<info>生成しました：</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>既存の zip ファイルを削除できません：</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>zip ファイルを作成できません：</error> <comment>{path}</comment>",
            'description_name' => 'App プラグイン名',
            'description_yes' => '確認をスキップ',
            'description_from' => 'From バージョン (デフォルト: 現在のバージョン)',
            'description_to' => 'To バージョン (デフォルト: 現在のバージョン)',
            'source_not_exists' => "ソースディレクトリが存在しません：{path}",
        ];

        $ko = [
            'bad_name' => "<error>잘못된 플러그인 이름: </error> <comment>{name}</comment>\n<comment>규칙</comment> plugin/ 아래 폴더 이름만 허용되며, 영문/숫자/밑줄/하이픈만 사용 가능합니다（/ 또는 \\ 포함 불가）.",
            'plugin_not_exists' => "<error>플러그인을 찾을 수 없습니다:</error> <comment>{path}</comment>",
            'create_title' => "<info>App 플러그인 생성</info> <comment>{name}</comment>",
            'install_title' => "<info>App 플러그인 설치</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>App 플러그인 제거</info> <comment>{name}</comment>",
            'update_title' => "<info>App 플러그인 업데이트</info> <comment>{name}</comment>",
            'zip_title' => "<info>App 플러그인 ZIP 패키징</info> <comment>{name}</comment>",
            'dir_exists' => "<error>디렉터리가 이미 존재합니다:</error> <comment>{path}</comment>",
            'created_dir' => "<info>디렉터리 생성:</info> <comment>{path}</comment>",
            'created_file' => "<info>파일 생성:</info> <comment>{path}</comment>",
            'script_missing' => "<error>설치 스크립트를 찾을 수 없습니다:</error> <comment>{class}</comment>\n<comment>참고</comment> composer.json을 수정한 경우 <info>composer dumpautoload</info> 를 실행하세요.",
            'uninstall_confirm' => "<fg=yellow>제거 스크립트를 실행하면 데이터가 삭제될 수 있습니다. 계속하시겠습니까? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>실행</comment> {class}::{method}({args})",
            'done' => "<info>완료</info>",
            'failed' => "<error>실패:</error> <comment>{error}</comment>",
            'version_same' => "<comment>참고</comment> from/to 버전이 동일합니다（{version}）. 마이그레이션이 필요 없으면 무시해도 됩니다.",
            'zip_saved' => "<info>생성됨:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>기존 zip 파일을 삭제할 수 없습니다:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>zip 파일을 생성할 수 없습니다:</error> <comment>{path}</comment>",
            'description_name' => 'App 플러그인 이름',
            'description_yes' => '확인 건너뛰기',
            'description_from' => '시작 버전 (기본: 현재 버전)',
            'description_to' => '대상 버전 (기본: 현재 버전)',
            'source_not_exists' => "소스 디렉터리가 존재하지 않습니다: {path}",
        ];

        $fr = [
            'bad_name' => "<error>Nom de plugin invalide : </error> <comment>{name}</comment>\n<comment>Règles</comment> Doit être un nom de dossier sous plugin/, uniquement lettres/chiffres/tiret souligné/tiret (ne doit pas contenir / ou \\).",
            'plugin_not_exists' => "<error>Plugin introuvable :</error> <comment>{path}</comment>",
            'create_title' => "<info>Créer le plugin App</info> <comment>{name}</comment>",
            'install_title' => "<info>Installer le plugin App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Désinstaller le plugin App</info> <comment>{name}</comment>",
            'update_title' => "<info>Mettre à jour le plugin App</info> <comment>{name}</comment>",
            'zip_title' => "<info>Zipper le plugin App</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Le répertoire existe déjà :</error> <comment>{path}</comment>",
            'created_dir' => "<info>Répertoire créé :</info> <comment>{path}</comment>",
            'created_file' => "<info>Fichier créé :</info> <comment>{path}</comment>",
            'script_missing' => "<error>Script d'installation introuvable :</error> <comment>{class}</comment>\n<comment>Note</comment> Si vous venez de modifier composer.json, exécutez : <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Le script de désinstallation va s'exécuter et peut supprimer des données. Continuer ? [y/N] (Entrée = N)</>\n",
            'running' => "<comment>Exécution</comment> {class}::{method}({args})",
            'done' => "<info>Terminé</info>",
            'failed' => "<error>Échec :</error> <comment>{error}</comment>",
            'version_same' => "<comment>Note</comment> Les versions from/to sont identiques ({version}). Ignorez si aucune migration n'est nécessaire.",
            'zip_saved' => "<info>Généré :</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Impossible de supprimer le fichier zip existant :</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Impossible de créer le fichier zip :</error> <comment>{path}</comment>",
            'description_name' => 'Nom du plugin App',
            'description_yes' => 'Passer la confirmation',
            'description_from' => 'Version de départ (par défaut : version actuelle)',
            'description_to' => 'Version cible (par défaut : version actuelle)',
            'source_not_exists' => "Le répertoire source n'existe pas : {path}",
        ];

        $de = [
            'bad_name' => "<error>Ungültiger Plugin-Name: </error> <comment>{name}</comment>\n<comment>Regeln</comment> Muss ein Ordnername unter plugin/ sein, nur Buchstaben/Ziffern/Unterstrich/Bindestrich (darf / oder \\ nicht enthalten).",
            'plugin_not_exists' => "<error>Plugin nicht gefunden:</error> <comment>{path}</comment>",
            'create_title' => "<info>App-Plugin erstellen</info> <comment>{name}</comment>",
            'install_title' => "<info>App-Plugin installieren</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>App-Plugin deinstallieren</info> <comment>{name}</comment>",
            'update_title' => "<info>App-Plugin aktualisieren</info> <comment>{name}</comment>",
            'zip_title' => "<info>App-Plugin als ZIP packen</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Verzeichnis existiert bereits:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Verzeichnis erstellt:</info> <comment>{path}</comment>",
            'created_file' => "<info>Datei erstellt:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Installationsskript nicht gefunden:</error> <comment>{class}</comment>\n<comment>Hinweis</comment> Bei Änderung von composer.json bitte ausführen: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Deinstallationsskript wird ausgeführt und kann Daten löschen. Fortfahren? [y/N] (Eingabe = N)</>\n",
            'running' => "<comment>Ausführen</comment> {class}::{method}({args})",
            'done' => "<info>Fertig</info>",
            'failed' => "<error>Fehlgeschlagen:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Hinweis</comment> from/to-Versionen sind gleich ({version}). Kann ignoriert werden, wenn keine Migration nötig ist.",
            'zip_saved' => "<info>Erstellt:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Vorhandene ZIP-Datei kann nicht gelöscht werden:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>ZIP-Datei kann nicht erstellt werden:</error> <comment>{path}</comment>",
            'description_name' => 'App-Plugin-Name',
            'description_yes' => 'Bestätigung überspringen',
            'description_from' => 'Von-Version (Standard: aktuelle Version)',
            'description_to' => 'Bis-Version (Standard: aktuelle Version)',
            'source_not_exists' => "Quellverzeichnis existiert nicht: {path}",
        ];

        $es = [
            'bad_name' => "<error>Nombre de plugin no válido: </error> <comment>{name}</comment>\n<comment>Reglas</comment> Debe ser un nombre de carpeta bajo plugin/, solo letras/números/guion bajo/guion (no debe contener / o \\).",
            'plugin_not_exists' => "<error>Plugin no encontrado:</error> <comment>{path}</comment>",
            'create_title' => "<info>Crear plugin App</info> <comment>{name}</comment>",
            'install_title' => "<info>Instalar plugin App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Desinstalar plugin App</info> <comment>{name}</comment>",
            'update_title' => "<info>Actualizar plugin App</info> <comment>{name}</comment>",
            'zip_title' => "<info>Comprimir plugin App en ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>El directorio ya existe:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Directorio creado:</info> <comment>{path}</comment>",
            'created_file' => "<info>Archivo creado:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Script de instalación no encontrado:</error> <comment>{class}</comment>\n<comment>Nota</comment> Si acaba de modificar composer.json, ejecute: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Se ejecutará el script de desinstalación y puede borrar datos. ¿Continuar? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Ejecutar</comment> {class}::{method}({args})",
            'done' => "<info>Hecho</info>",
            'failed' => "<error>Error:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Nota</comment> Las versiones from/to son iguales ({version}). Puede ignorarse si no hay migración.",
            'zip_saved' => "<info>Generado:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>No se puede eliminar el archivo zip existente:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>No se puede crear el archivo zip:</error> <comment>{path}</comment>",
            'description_name' => 'Nombre del plugin App',
            'description_yes' => 'Omitir confirmación',
            'description_from' => 'Versión inicial (por defecto: versión actual)',
            'description_to' => 'Versión objetivo (por defecto: versión actual)',
            'source_not_exists' => "El directorio origen no existe: {path}",
        ];

        $ptBr = [
            'bad_name' => "<error>Nome de plugin inválido: </error> <comment>{name}</comment>\n<comment>Regras</comment> Deve ser um nome de pasta em plugin/, apenas letras/números/underscore/hífen (não pode conter / ou \\).",
            'plugin_not_exists' => "<error>Plugin não encontrado:</error> <comment>{path}</comment>",
            'create_title' => "<info>Criar plugin App</info> <comment>{name}</comment>",
            'install_title' => "<info>Instalar plugin App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Desinstalar plugin App</info> <comment>{name}</comment>",
            'update_title' => "<info>Atualizar plugin App</info> <comment>{name}</comment>",
            'zip_title' => "<info>Empacotar plugin App em ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>O diretório já existe:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Criar diretório:</info> <comment>{path}</comment>",
            'created_file' => "<info>Criar arquivo:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Script de instalação não encontrado:</error> <comment>{class}</comment>\n<comment>Nota</comment> Se você acabou de alterar o composer.json, execute: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>O script de desinstalação será executado e pode excluir dados. Continuar? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Executar</comment> {class}::{method}({args})",
            'done' => "<info>Concluído</info>",
            'failed' => "<error>Falhou:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Nota</comment> As versões from/to são iguais ({version}). Pode ignorar se não houver migração.",
            'zip_saved' => "<info>Gerado:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Não foi possível excluir o arquivo zip existente:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Não foi possível criar o arquivo zip:</error> <comment>{path}</comment>",
            'description_name' => 'Nome do plugin App',
            'description_yes' => 'Pular confirmação',
            'description_from' => 'Versão de (padrão: versão atual)',
            'description_to' => 'Versão para (padrão: versão atual)',
            'source_not_exists' => "O diretório de origem não existe: {path}",
        ];

        $ru = [
            'bad_name' => "<error>Недопустимое имя плагина: </error> <comment>{name}</comment>\n<comment>Правила</comment> Должно быть именем папки в plugin/, только буквы/цифры/подчёркивание/дефис (не должно содержать / или \\).",
            'plugin_not_exists' => "<error>Плагин не найден:</error> <comment>{path}</comment>",
            'create_title' => "<info>Создать App-плагин</info> <comment>{name}</comment>",
            'install_title' => "<info>Установить App-плагин</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Удалить App-плагин</info> <comment>{name}</comment>",
            'update_title' => "<info>Обновить App-плагин</info> <comment>{name}</comment>",
            'zip_title' => "<info>Упаковать App-плагин в ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Каталог уже существует:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Создать каталог:</info> <comment>{path}</comment>",
            'created_file' => "<info>Создать файл:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Скрипт установки не найден:</error> <comment>{class}</comment>\n<comment>Примечание</comment> Если вы только что изменили composer.json, выполните: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Будет выполнен скрипт удаления, данные могут быть удалены. Продолжить? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Выполнить</comment> {class}::{method}({args})",
            'done' => "<info>Готово</info>",
            'failed' => "<error>Ошибка:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Примечание</comment> Версии from/to совпадают ({version}). Можно игнорировать, если миграция не нужна.",
            'zip_saved' => "<info>Создано:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Не удалось удалить существующий zip-файл:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Не удалось создать zip-файл:</error> <comment>{path}</comment>",
            'description_name' => 'Имя App-плагина',
            'description_yes' => 'Пропустить подтверждение',
            'description_from' => 'Версия от (по умолчанию: текущая)',
            'description_to' => 'Версия до (по умолчанию: текущая)',
            'source_not_exists' => "Исходный каталог не существует: {path}",
        ];

        $vi = [
            'bad_name' => "<error>Tên plugin không hợp lệ: </error> <comment>{name}</comment>\n<comment>Quy tắc</comment> Phải là tên thư mục trong plugin/, chỉ cho phép chữ/số/gạch dưới/gạch ngang (không được chứa / hoặc \\).",
            'plugin_not_exists' => "<error>Không tìm thấy plugin:</error> <comment>{path}</comment>",
            'create_title' => "<info>Tạo plugin App</info> <comment>{name}</comment>",
            'install_title' => "<info>Cài đặt plugin App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Gỡ cài đặt plugin App</info> <comment>{name}</comment>",
            'update_title' => "<info>Cập nhật plugin App</info> <comment>{name}</comment>",
            'zip_title' => "<info>Đóng gói plugin App thành ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Thư mục đã tồn tại:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Tạo thư mục:</info> <comment>{path}</comment>",
            'created_file' => "<info>Tạo tệp:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Không tìm thấy script cài đặt:</error> <comment>{class}</comment>\n<comment>Lưu ý</comment> Nếu vừa sửa composer.json, hãy chạy: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Script gỡ cài đặt sẽ chạy và có thể xóa dữ liệu. Tiếp tục? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Chạy</comment> {class}::{method}({args})",
            'done' => "<info>Xong</info>",
            'failed' => "<error>Thất bại:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Lưu ý</comment> Phiên bản from/to giống nhau ({version}). Có thể bỏ qua nếu không cần di chuyển.",
            'zip_saved' => "<info>Đã tạo:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Không thể xóa tệp zip hiện có:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Không thể tạo tệp zip:</error> <comment>{path}</comment>",
            'description_name' => 'Tên plugin App',
            'description_yes' => 'Bỏ qua xác nhận',
            'description_from' => 'Phiên bản từ (mặc định: phiên bản hiện tại)',
            'description_to' => 'Phiên bản đến (mặc định: phiên bản hiện tại)',
            'source_not_exists' => "Thư mục nguồn không tồn tại: {path}",
        ];

        $tr = [
            'bad_name' => "<error>Geçersiz eklenti adı: </error> <comment>{name}</comment>\n<comment>Kurallar</comment> plugin/ altında bir klasör adı olmalı, yalnızca harf/rakam/alt çizgi/tire (/ veya \\ içermemeli).",
            'plugin_not_exists' => "<error>Eklenti bulunamadı:</error> <comment>{path}</comment>",
            'create_title' => "<info>App eklentisi oluştur</info> <comment>{name}</comment>",
            'install_title' => "<info>App eklentisini yükle</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>App eklentisini kaldır</info> <comment>{name}</comment>",
            'update_title' => "<info>App eklentisini güncelle</info> <comment>{name}</comment>",
            'zip_title' => "<info>App eklentisini ZIP'le</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Dizin zaten mevcut:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Dizin oluştur:</info> <comment>{path}</comment>",
            'created_file' => "<info>Dosya oluştur:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Kurulum betiği bulunamadı:</error> <comment>{class}</comment>\n<comment>Not</comment> composer.json'ı yeni değiştirdiyseniz çalıştırın: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Kaldırma betiği çalışacak ve veriler silinebilir. Devam? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Çalıştır</comment> {class}::{method}({args})",
            'done' => "<info>Tamamlandı</info>",
            'failed' => "<error>Başarısız:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Not</comment> from/to sürümleri aynı ({version}). Taşıma gerekmiyorsa yok sayabilirsiniz.",
            'zip_saved' => "<info>Oluşturuldu:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Mevcut zip dosyası silinemiyor:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Zip dosyası oluşturulamıyor:</error> <comment>{path}</comment>",
            'description_name' => 'App eklenti adı',
            'description_yes' => 'Onayı atla',
            'description_from' => 'Başlangıç sürümü (varsayılan: geçerli sürüm)',
            'description_to' => 'Hedef sürüm (varsayılan: geçerli sürüm)',
            'source_not_exists' => "Kaynak dizin mevcut değil: {path}",
        ];

        $id = [
            'bad_name' => "<error>Nama plugin tidak valid: </error> <comment>{name}</comment>\n<comment>Aturan</comment> Harus nama folder di bawah plugin/, hanya huruf/angka/underscore/tanda hubung (tidak boleh mengandung / atau \\).",
            'plugin_not_exists' => "<error>Plugin tidak ditemukan:</error> <comment>{path}</comment>",
            'create_title' => "<info>Buat plugin App</info> <comment>{name}</comment>",
            'install_title' => "<info>Pasang plugin App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Lepas pemasangan plugin App</info> <comment>{name}</comment>",
            'update_title' => "<info>Perbarui plugin App</info> <comment>{name}</comment>",
            'zip_title' => "<info>Bungkus plugin App ke ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>Direktori sudah ada:</error> <comment>{path}</comment>",
            'created_dir' => "<info>Buat direktori:</info> <comment>{path}</comment>",
            'created_file' => "<info>Buat file:</info> <comment>{path}</comment>",
            'script_missing' => "<error>Skrip instalasi tidak ditemukan:</error> <comment>{class}</comment>\n<comment>Catatan</comment> Jika Anda baru mengubah composer.json, jalankan: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>Skrip copot akan dijalankan dan dapat menghapus data. Lanjutkan? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>Jalankan</comment> {class}::{method}({args})",
            'done' => "<info>Selesai</info>",
            'failed' => "<error>Gagal:</error> <comment>{error}</comment>",
            'version_same' => "<comment>Catatan</comment> Versi from/to sama ({version}). Dapat diabaikan jika tidak ada migrasi.",
            'zip_saved' => "<info>Berhasil dibuat:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>Tidak dapat menghapus file zip yang ada:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>Tidak dapat membuat file zip:</error> <comment>{path}</comment>",
            'description_name' => 'Nama plugin App',
            'description_yes' => 'Skip confirmation',
            'description_from' => 'From version (default: current version)',
            'description_to' => 'To version (default: current version)',
            'source_not_exists' => "Direktori sumber tidak ada: {path}",
        ];

        $th = [
            'bad_name' => "<error>ชื่อปลั๊กอินไม่ถูกต้อง: </error> <comment>{name}</comment>\n<comment>กฎ</comment> ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ เท่านั้น ใช้ได้แค่ตัวอักษร/ตัวเลข/ขีดล่าง/ขีด (ห้ามมี / หรือ \\)",
            'plugin_not_exists' => "<error>ไม่พบปลั๊กอิน:</error> <comment>{path}</comment>",
            'create_title' => "<info>สร้างปลั๊กอิน App</info> <comment>{name}</comment>",
            'install_title' => "<info>ติดตั้งปลั๊กอิน App</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>ถอนการติดตั้งปลั๊กอิน App</info> <comment>{name}</comment>",
            'update_title' => "<info>อัปเดตปลั๊กอิน App</info> <comment>{name}</comment>",
            'zip_title' => "<info>บีบอัดปลั๊กอิน App เป็น ZIP</info> <comment>{name}</comment>",
            'dir_exists' => "<error>มีไดเรกทอรีอยู่แล้ว:</error> <comment>{path}</comment>",
            'created_dir' => "<info>สร้างไดเรกทอรี:</info> <comment>{path}</comment>",
            'created_file' => "<info>สร้างไฟล์:</info> <comment>{path}</comment>",
            'script_missing' => "<error>ไม่พบสคริปต์ติดตั้ง:</error> <comment>{class}</comment>\n<comment>หมายเหตุ</comment> หากเพิ่งแก้ composer.json กรุณารัน: <info>composer dumpautoload</info>",
            'uninstall_confirm' => "<fg=yellow>จะรันสคริปต์ถอนการติดตั้งและอาจลบข้อมูล ดำเนินการต่อ? [y/N] (Enter default: N)</>\n",
            'running' => "<comment>รัน</comment> {class}::{method}({args})",
            'done' => "<info>เสร็จสิ้น</info>",
            'failed' => "<error>ล้มเหลว:</error> <comment>{error}</comment>",
            'version_same' => "<comment>หมายเหตุ</comment> เวอร์ชัน from/to เหมือนกัน ({version}) ข้ามได้หากไม่มีการย้ายข้อมูล",
            'zip_saved' => "<info>สร้างแล้ว:</info> <comment>{path}</comment>",
            'zip_delete_failed' => "<error>ลบไฟล์ zip เดิมไม่ได้:</error> <comment>{path}</comment>",
            'zip_open_failed' => "<error>สร้างไฟล์ zip ไม่ได้:</error> <comment>{path}</comment>",
            'description_name' => 'ชื่อปลั๊กอิน App',
            'description_yes' => 'Skip confirmation',
            'description_from' => 'From version (default: current version)',
            'description_to' => 'To version (default: current version)',
            'source_not_exists' => "ไม่มีไดเรกทอรีต้นทาง：{path}",
        ];

        return [
            'zh_CN' => $zhCn,
            'zh_TW' => $zhTw,
            'en' => $en,
            'ja' => $ja,
            'ko' => $ko,
            'fr' => $fr,
            'de' => $de,
            'es' => $es,
            'pt_BR' => $ptBr,
            'ru' => $ru,
            'vi' => $vi,
            'tr' => $tr,
            'id' => $id,
            'th' => $th,
        ];
    }

    public static function getMakeCrudMessages(): array
    {
        $zh = [
            'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。路径必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
            'table_required' => '<error>必须提供数据表名（--table）或在交互模式下选择数据表。</error>',
            'validation_not_enabled' => '<error>webman/validation 未启用或未安装，无法生成验证器。</error>',
            'validation_not_installed_skip' => '<comment>未安装验证器 webman/validation，跳过验证器代码生成</comment>',
            'validation_not_enabled_skip' => '<comment>验证器 webman/validation 未启用，跳过验证器代码生成</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>验证器 webman/validation 未启用中间件，跳过验证器代码生成</comment>',
            'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
            'crud_generated' => '<info>已生成 {count} 个文件：</info>',
            'nothing_generated' => '<comment>[Warning]</comment> 没有生成任何文件。',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> 验证器生成失败：<comment>{reason}</comment>，已生成空验证器。',
            'db_unavailable' => '<comment>[Warning]</comment> 数据库不可用或无权限读取表信息，将继续使用交互选择或生成空模型。',
            'table_list_failed' => '<comment>[Warning]</comment> 无法获取数据表列表，将继续使用交互选择或生成空模型。',
            'db_connect_failed' => '<error>无法连接数据库，请检查 {configPath} 配置</error>',
            'db_permission_denied' => '<error>数据库用户{user}没有读取数据库{database}表结构权限{hint}</error>',
            'db_permission_denied_hint' => '，请尝试使用 -t 指定表名',
            'no_match' => '<comment>[Info]</comment> 未找到与模型名匹配的表（按约定推断失败）。',
            'prompt_help' => '<comment>[Info]</comment> 输入序号选择；输入表名；回车=更多；输入 0=空模型；输入 /关键字 过滤（输入 / 清除过滤）。',
            'no_more' => '<comment>[Info]</comment> 没有更多表可显示。',
            'end_of_list' => '<comment>[Info]</comment> 已到列表末尾。可输入表名、序号、0（空模型）或 /关键字。',
            'filter_cleared' => '<comment>[Info]</comment> 已清除过滤条件。',
            'filter_applied' => '<comment>[Info]</comment> 已应用过滤：`{keyword}`。',
            'filter_no_match' => '<comment>[Warning]</comment> 没有表匹配过滤 `{keyword}`。输入 / 清除过滤或换个关键字。',
            'selection_out_of_range' => '<comment>[Warning]</comment> 序号超出范围。可回车查看更多或输入有效序号。',
            'table_not_in_list' => '<comment>[Warning]</comment> 表 `{table}` 不在当前数据库列表中，将继续尝试生成（注释可能为空）。',
            'showing_range' => '<comment>[Info]</comment> 当前已显示 {start}-{end}（累计 {shown}）。',
            'connection_not_found' => '<error>数据库连接不存在：</error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>插件 </error> <comment>{plugin}</comment> <error> 未配置数据库连接：</error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>数据库连接与插件不匹配：当前插件=</error> <comment>{plugin}</comment> <error>，连接=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>插件 </error> <comment>{plugin}</comment> <error> 的默认数据库连接无效：</error> <comment>{connection}</comment>',
            'enter_name_prompt' => '输入{label} (回车默认 {default}): ',
            'enter_path_prompt' => '输入{label}路径 (回车默认 {default}): ',
            'invalid_name' => '<error>名称无效：</error> <comment>{type}</comment>',
            'plugin_path_mismatch' => '<error>插件与路径不一致：--plugin=</error> <comment>{plugin}</comment> <error>，但路径推断插件=</error> <comment>{path_plugin}</comment> <error>。</error>',
            'plugin_path_mismatch_confirm' => "<question>插件与路径不一致：--plugin={plugin}，但路径推断插件={path_plugin}</question>\n<question>是否继续使用 --plugin？[Y/n]（回车默认 Y）</question>\n",
            'plugin_reinput_prompt' => '请重新输入插件名 [{default}]: ',
            'reference_only' => '提示：生成代码仅供参考，请根据实际业务完善。',
            'opt_table' => '表名，例如：users',
            'opt_model' => '模型名，例如：User, admin/User',
            'opt_model_path' => '模型路径 (相对路径)，例如：plugin/admin/app/model',
            'opt_controller' => '控制器名，例如：UserController, admin/UserController',
            'opt_controller_path' => '控制器路径 (相对路径)，例如：plugin/admin/app/controller',
            'opt_validator' => '验证器名，例如：UserValidator, admin/UserValidator',
            'opt_validator_path' => '验证器路径 (相对路径)，例如：plugin/admin/app/validation',
            'opt_plugin' => '插件名，例如：admin',
            'opt_orm' => '选择 ORM：laravel|thinkorm',
            'opt_database' => '选择数据库连接',
            'opt_force' => '强制覆盖已存在文件',
            'opt_no_validator' => '不生成验证器',
            'opt_no_interaction' => '禁用交互模式',
        ];

        $en = [
            'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
            'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. Path must be relative (to project root), not absolute.</error>',
            'table_required' => '<error>Table is required. Provide --table or select it interactively.</error>',
            'validation_not_enabled' => '<error>webman/validation is not enabled or installed; validator generation skipped.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation is not installed; skipping validator code generation.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation is not enabled; skipping validator code generation.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>webman/validation middleware is not enabled; skipping validator code generation.</comment>',
            'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Generated {count} files:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Nothing generated.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Validator generation failed: {reason}. Generated an empty validator.',
            'db_unavailable' => '<comment>[Warning]</comment> Database is not accessible or access was denied. Will continue with interactive selection or empty model.',
            'table_list_failed' => '<comment>[Warning]</comment> Unable to fetch table list. Will continue with interactive selection or empty model.',
            'db_connect_failed' => '<error>Cannot connect to database. Check {configPath}.</error>',
            'db_permission_denied' => '<error>Database user {user} lacks permission to read schema for {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Try using -t to specify a table.',
            'no_match' => '<comment>[Info]</comment> No table matched the model name by convention.',
            'prompt_help' => '<comment>[Info]</comment> Enter a number to select, type a table name, press Enter for more, enter 0 for an empty model, or use /keyword to filter (use / to clear).',
            'no_more' => '<comment>[Info]</comment> No more tables to show.',
            'end_of_list' => '<comment>[Info]</comment> End of list. Type a table name, a number, 0 for empty, or /keyword.',
            'filter_cleared' => '<comment>[Info]</comment> Filter cleared.',
            'filter_applied' => '<comment>[Info]</comment> Filter applied: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> No tables matched filter `{keyword}`. Use / to clear or try another keyword.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Selection out of range. Press Enter for more, or choose a valid number.',
            'table_not_in_list' => '<comment>[Warning]</comment> Table `{table}` is not in the current database list. Will try to generate anyway (schema annotations may be empty).',
            'showing_range' => '<comment>[Info]</comment> Showing {start}-{end} (total shown: {shown}).',
            'connection_not_found' => '<error>Database connection not found: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> has no database connection configured: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Database connection does not match plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Invalid default database connection for plugin </error> <comment>{plugin}</comment> <error>: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Enter {label} (Enter default: {default}): ',
            'enter_path_prompt' => 'Enter {label} path (Enter default: {default}): ',
            'invalid_name' => '<error>Invalid </error> <comment>{type}</comment> <error> name.</error>',
            'plugin_path_mismatch' => '<error>Plugin and path mismatch: --plugin=</error> <comment>{plugin}</comment> <error>, but inferred plugin from path=</error> <comment>{path_plugin}</comment> <error>.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin and path mismatch: --plugin={plugin}, inferred from path={path_plugin}</question>\n<question>Continue using --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Please re-enter plugin name [{default}]: ',
            'reference_only' => 'Note: Generated code is for reference only; please complete it based on your actual business logic.',
            'opt_table' => 'Table name. e.g. users',
            'opt_model' => 'Model name. e.g. User, admin/User',
            'opt_model_path' => 'Model path (relative to base path). e.g. plugin/admin/app/model',
            'opt_controller' => 'Controller name. e.g. UserController, admin/UserController',
            'opt_controller_path' => 'Controller path (relative to base path). e.g. plugin/admin/app/controller',
            'opt_validator' => 'Validator name. e.g. UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Validator path (relative to base path). e.g. plugin/admin/app/validation',
            'opt_plugin' => 'Plugin name under plugin/. e.g. admin',
            'opt_orm' => 'Select ORM: laravel|thinkorm',
            'opt_database' => 'Select database connection.',
            'opt_force' => 'Overwrite existing files without confirmation.',
            'opt_no_validator' => 'Do not generate validator.',
            'opt_no_interaction' => 'Disable interactive mode.',
        ];

        $ja = [
            'invalid_plugin' => '<error>無効なプラグイン名：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名である必要があり、/ や \\ を含めることはできません。</error>',
            'invalid_path' => '<error>無効なパス：</error> <comment>{path}</comment> <error>。パスは（プロジェクトルートからの）相対パスである必要があり、絶対パスは使用できません。</error>',
            'table_required' => '<error>テーブル名は必須です（--table）または対話モードで選択してください。</error>',
            'validation_not_enabled' => '<error>webman/validation が有効になっていないかインストールされていません。バリデータの生成をスキップします。</error>',
            'validation_not_installed_skip' => '<comment>webman/validation がインストールされていません。バリデータのコード生成をスキップします。</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation が有効になっていません。バリデータのコード生成をスキップします。</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>webman/validation のミドルウェアが有効になっていません。バリデータのコード生成をスキップします。</comment>',
            'override_prompt' => "<question>ファイルは既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
            'crud_generated' => '<info>{count} 個のファイルを生成しました：</info>',
            'nothing_generated' => '<comment>[Warning]</comment> ファイルは生成されませんでした。',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> バリデータの生成に失敗しました：<comment>{reason}</comment>。空のバリデータを生成しました。',
            'db_unavailable' => '<comment>[Warning]</comment> データベースにアクセスできないか、テーブル情報の読み取り権限がありません。対話選択または空のモデルの生成を続行します。',
            'table_list_failed' => '<comment>[Warning]</comment> テーブルリストを取得できません。対話選択または空のモデルの生成を続行します。',
            'db_connect_failed' => '<error>データベースに接続できません。{configPath} を確認してください。</error>',
            'db_permission_denied' => '<error>データベースユーザー{user}は{database}のテーブル構造を読み取る権限がありません。{hint}</error>',
            'db_permission_denied_hint' => ' -tでテーブルを指定してみてください。',
            'no_match' => '<comment>[Info]</comment> モデル名と一致するテーブルが見つかりませんでした（規約による推論）。',
            'prompt_help' => '<comment>[Info]</comment> 番号を入力して選択、テーブル名を入力、Enterで詳細表示、0で空のモデル、/キーワード でフィルタリング（/ でフィルタ解除）。',
            'no_more' => '<comment>[Info]</comment> これ以上表示するテーブルはありません。',
            'end_of_list' => '<comment>[Info]</comment> リストの最後です。テーブル名、番号、0（空モデル）、または /キーワード を入力してください。',
            'filter_cleared' => '<comment>[Info]</comment> フィルタ条件をクリアしました。',
            'filter_applied' => '<comment>[Info]</comment> フィルタ適用：`{keyword}`。',
            'filter_no_match' => '<comment>[Warning]</comment> フィルタ `{keyword}` に一致するテーブルはありません。/ でクリアするか、別のキーワードを試してください。',
            'selection_out_of_range' => '<comment>[Warning]</comment> 番号が範囲外です。Enterで詳細を表示するか、有効な番号を選択してください。',
            'table_not_in_list' => '<comment>[Warning]</comment> テーブル `{table}` は現在のデータベースリストにありません。生成を試みます（注釈が空になる可能性があります）。',
            'showing_range' => '<comment>[Info]</comment> 現在 {start}-{end} を表示中（累計 {shown}）。',
            'connection_not_found' => '<error>データベース接続が存在しません：</error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>プラグイン </error> <comment>{plugin}</comment> <error> にデータベース接続が設定されていません：</error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>データベース接続がプラグインと一致しません：現在のプラグイン=</error> <comment>{plugin}</comment> <error>、接続=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>プラグイン </error> <comment>{plugin}</comment> <error> のデフォルトデータベース接続が無効です：</error> <comment>{connection}</comment>',
            'enter_name_prompt' => '{label}を入力 (Enterでデフォルト {default}): ',
            'enter_path_prompt' => '{label}のパスを入力 (Enterでデフォルト {default}): ',
            'invalid_name' => '<error>無効な名前：</error> <comment>{type}</comment>',
            'plugin_path_mismatch' => '<error>プラグインとパスが一致しません：--plugin={plugin}、しかしパスから推論されたプラグイン={path_plugin}。</error>',
            'plugin_path_mismatch_confirm' => "<question>プラグインとパスが一致しません：--plugin={plugin}、しかしパスから推論されたプラグイン={path_plugin}</question>\n<question>--plugin を使用し続けますか？[Y/n]（Enter default: Y）</question>\n",
            'plugin_reinput_prompt' => 'プラグイン名を再入力してください [{default}]: ',
            'reference_only' => 'ヒント：生成されたコードは参照用です。実際のビジネスに合わせて修正してください。',
            'opt_table' => 'テーブル名。例：users',
            'opt_model' => 'モデル名。例：User, admin/User',
            'opt_model_path' => 'モデルパス（相対）。例：plugin/admin/app/model',
            'opt_controller' => 'コントローラ名。例：UserController, admin/UserController',
            'opt_controller_path' => 'コントローラパス（相対）。例：plugin/admin/app/controller',
            'opt_validator' => 'バリデータ名。例：UserValidator, admin/UserValidator',
            'opt_validator_path' => 'バリデータパス（相対）。例：plugin/admin/app/validation',
            'opt_plugin' => 'プラグイン名。例：admin',
            'opt_orm' => 'ORM を選択：laravel|thinkorm',
            'opt_database' => 'データベース接続を選択',
            'opt_force' => '既存ファイルを確認なしで上書き',
            'opt_no_validator' => 'バリデータを生成しない',
            'opt_no_interaction' => '対話モードを無効にする',
        ];

        $ko = [
            'invalid_plugin' => '<error>플러그인 이름이 잘못되었습니다: {plugin}. `--plugin/-p`는 plugin/ 디렉터리 아래의 디렉터리 이름이어야 하며, / 또는 \\를 포함할 수 없습니다.</error>',
            'invalid_path' => '<error>경로가 잘못되었습니다: </error> <comment>{path}</comment> <error>. 경로는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 사용할 수 없습니다.</error>',
            'table_required' => '<error>테이블 이름이 필요합니다. --table을 지정하거나 대화 모드에서 선택하세요.</error>',
            'validation_not_enabled' => '<error>webman/validation이 활성화되지 않았거나 설치되지 않았습니다. 검증기 생성이 건너뜁니다.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation이 설치되지 않았습니다. 검증기 코드 생성을 건너뜁니다.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation이 활성화되지 않았습니다. 검증기 코드 생성을 건너뜁니다.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>webman/validation 미들웨어가 활성화되지 않았습니다. 검증기 코드 생성을 건너뜁니다.</comment>',
            'override_prompt' => "<question>파일이 이미 존재합니다: {path}</question>\n<question>덮어쓰시겠습니까? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>{count}개 파일을 생성했습니다:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> 생성된 파일이 없습니다.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> 검증기 생성 실패: {reason}. 빈 검증기를 생성했습니다.',
            'db_unavailable' => '<comment>[Warning]</comment> 데이터베이스에 접근할 수 없거나 권한이 없습니다. 대화 선택 또는 빈 모델로 계속합니다.',
            'table_list_failed' => '<comment>[Warning]</comment> 테이블 목록을 가져올 수 없습니다. 대화 선택 또는 빈 모델로 계속합니다.',
            'db_connect_failed' => '<error>데이터베이스에 연결할 수 없습니다. {configPath} 설정을 확인하세요.</error>',
            'db_permission_denied' => '<error>데이터베이스 사용자 {user}에 {database} 테이블 구조 읽기 권한이 없습니다.{hint}</error>',
            'db_permission_denied_hint' => ' -t로 테이블을 지정해 보세요.',
            'no_match' => '<comment>[Info]</comment> 규칙에 따라 모델 이름과 일치하는 테이블이 없습니다.',
            'prompt_help' => '<comment>[Info]</comment> 번호 입력으로 선택, 테이블명 입력, Enter로 더 보기, 0으로 빈 모델, /키워드로 필터(/로 필터 해제).',
            'no_more' => '<comment>[Info]</comment> 더 표시할 테이블이 없습니다.',
            'end_of_list' => '<comment>[Info]</comment> 목록 끝. 테이블명, 번호, 0(빈 모델) 또는 /키워드 입력.',
            'filter_cleared' => '<comment>[Info]</comment> 필터가 해제되었습니다.',
            'filter_applied' => '<comment>[Info]</comment> 필터 적용: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> `{keyword}`에 일치하는 테이블이 없습니다. /로 해제하거나 다른 키워드를 사용하세요.',
            'selection_out_of_range' => '<comment>[Warning]</comment> 선택이 범위를 벗어났습니다. Enter로 더 보기 또는 유효한 번호를 선택하세요.',
            'table_not_in_list' => '<comment>[Warning]</comment> 테이블 `{table}`이 현재 데이터베이스 목록에 없습니다. 그래도 생성 시도(스키마 주석이 비어 있을 수 있음).',
            'showing_range' => '<comment>[Info]</comment> {start}-{end} 표시 중 (총 {shown}개).',
            'connection_not_found' => '<error>데이터베이스 연결을 찾을 수 없습니다: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>플러그인 {plugin}에 데이터베이스 연결이 설정되지 않았습니다: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>데이터베이스 연결이 플러그인과 일치하지 않습니다: 플러그인=</error> <comment>{plugin}</comment> <error>, 연결=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>플러그인 {plugin}의 기본 데이터베이스 연결이 잘못되었습니다: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => '{label} 입력 (Enter 시 기본값: {default}): ',
            'enter_path_prompt' => '{label} 경로 입력 (Enter 시 기본값: {default}): ',
            'invalid_name' => '<error>{type} 이름이 잘못되었습니다.</error>',
            'plugin_path_mismatch' => '<error>플러그인과 경로 불일치: --plugin={plugin}, 경로에서 추론한 플러그인={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>플러그인과 경로 불일치: --plugin={plugin}, 경로에서 추론={path_plugin}</question>\n<question>--plugin을 계속 사용하시겠습니까? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => '플러그인 이름을 다시 입력하세요 [{default}]: ',
            'reference_only' => '참고: 생성된 코드는 참고용이며, 실제 비즈니스에 맞게 수정하세요.',
            'opt_table' => '테이블 이름. 예: users',
            'opt_model' => '모델 이름. 예: User, admin/User',
            'opt_model_path' => '모델 경로(상대). 예: plugin/admin/app/model',
            'opt_controller' => '컨트롤러 이름. 예: UserController, admin/UserController',
            'opt_controller_path' => '컨트롤러 경로(상대). 예: plugin/admin/app/controller',
            'opt_validator' => '검증기 이름. 예: UserValidator, admin/UserValidator',
            'opt_validator_path' => '검증기 경로(상대). 예: plugin/admin/app/validation',
            'opt_plugin' => '플러그인 이름. 예: admin',
            'opt_orm' => 'ORM 선택: laravel|thinkorm',
            'opt_database' => '데이터베이스 연결 선택',
            'opt_force' => '확인 없이 기존 파일 덮어쓰기',
            'opt_no_validator' => '검증기 생성 안 함',
            'opt_no_interaction' => '대화 모드 비활성화',
        ];

        $fr = [
            'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de répertoire sous plugin/ et ne doit pas contenir / ou \\.</error>',
            'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. Le chemin doit être relatif (à la racine du projet), pas absolu.</error>',
            'table_required' => '<error>La table est requise. Fournissez --table ou sélectionnez-la en mode interactif.</error>',
            'validation_not_enabled' => '<error>webman/validation n\'est pas activé ou installé ; génération du validateur ignorée.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation n\'est pas installé ; génération du code du validateur ignorée.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation n\'est pas activé ; génération du code du validateur ignorée.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>Le middleware webman/validation n\'est pas activé ; génération du code du validateur ignorée.</comment>',
            'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n",
            'crud_generated' => '<info>{count} fichier(s) généré(s) :</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Rien n\'a été généré.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Échec de la génération du validateur : {reason}. Un validateur vide a été généré.',
            'db_unavailable' => '<comment>[Warning]</comment> Base de données inaccessible ou permission refusée. Poursuite avec sélection interactive ou modèle vide.',
            'table_list_failed' => '<comment>[Warning]</comment> Impossible d\'obtenir la liste des tables. Poursuite avec sélection interactive ou modèle vide.',
            'db_connect_failed' => '<error>Impossible de se connecter à la base de données. Vérifiez la configuration {configPath}.</error>',
            'db_permission_denied' => '<error>L\'utilisateur {user} n\'a pas la permission de lire le schéma de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Utilisez -t pour préciser une table.',
            'no_match' => '<comment>[Info]</comment> Aucune table ne correspond au nom du modèle par convention.',
            'prompt_help' => '<comment>[Info]</comment> Entrez un numéro pour sélectionner, tapez un nom de table, Entrée pour plus, 0 pour un modèle vide, ou /mot-clé pour filtrer (/ pour effacer).',
            'no_more' => '<comment>[Info]</comment> Plus de tables à afficher.',
            'end_of_list' => '<comment>[Info]</comment> Fin de liste. Tapez un nom de table, un numéro, 0 pour vide, ou /mot-clé.',
            'filter_cleared' => '<comment>[Info]</comment> Filtre effacé.',
            'filter_applied' => '<comment>[Info]</comment> Filtre appliqué : `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Aucune table ne correspond au filtre `{keyword}`. Utilisez / pour effacer ou un autre mot-clé.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Sélection hors limites. Entrée pour plus, ou choisissez un numéro valide.',
            'table_not_in_list' => '<comment>[Warning]</comment> La table `{table}` n\'est pas dans la liste actuelle. Génération tentée quand même (annotations de schéma peuvent être vides).',
            'showing_range' => '<comment>[Info]</comment> Affichage {start}-{end} (total affiché : {shown}).',
            'connection_not_found' => '<error>Connexion à la base de données introuvable : </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Le plugin </error> <comment>{plugin}</comment> <error> n\'a pas de connexion configurée : </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>La connexion ne correspond pas au plugin : plugin=</error> <comment>{plugin}</comment> <error>, connexion=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Connexion par défaut invalide pour le plugin </error> <comment>{plugin}</comment> <error> : </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Entrez {label} (Entrée pour défaut : {default}) : ',
            'enter_path_prompt' => 'Entrez le chemin {label} (Entrée pour défaut : {default}) : ',
            'invalid_name' => '<error>Nom {type} invalide.</error>',
            'plugin_path_mismatch' => '<error>Plugin et chemin incohérents : --plugin={plugin}, mais plugin déduit du chemin={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin et chemin incohérents : --plugin={plugin}, déduit du chemin={path_plugin}</question>\n<question>Continuer avec --plugin ? [Y/n] (Entrée par défaut: Y)</question>\n",
            'plugin_reinput_prompt' => 'Veuillez ressaisir le nom du plugin [{default}] : ',
            'reference_only' => 'Note : le code généré est à titre indicatif ; complétez-le selon votre logique métier.',
            'opt_table' => 'Nom de table. ex. users',
            'opt_model' => 'Nom du modèle. ex. User, admin/User',
            'opt_model_path' => 'Chemin du modèle (relatif). ex. plugin/admin/app/model',
            'opt_controller' => 'Nom du contrôleur. ex. UserController, admin/UserController',
            'opt_controller_path' => 'Chemin du contrôleur (relatif). ex. plugin/admin/app/controller',
            'opt_validator' => 'Nom du validateur. ex. UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Chemin du validateur (relatif). ex. plugin/admin/app/validation',
            'opt_plugin' => 'Nom du plugin sous plugin/. ex. admin',
            'opt_orm' => 'Choisir l\'ORM : laravel|thinkorm',
            'opt_database' => 'Choisir la connexion à la base de données.',
            'opt_force' => 'Écraser les fichiers existants sans confirmation.',
            'opt_no_validator' => 'Ne pas générer de validateur.',
            'opt_no_interaction' => 'Désactiver le mode interactif.',
        ];

        $de = [
            'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Verzeichnisname unter plugin/ sein und darf kein / oder \\ enthalten.</error>',
            'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. Der Pfad muss relativ (zum Projektroot) sein, nicht absolut.</error>',
            'table_required' => '<error>Tabelle ist erforderlich. Geben Sie --table an oder wählen Sie sie interaktiv.</error>',
            'validation_not_enabled' => '<error>webman/validation ist nicht aktiviert oder installiert; Validator-Generierung wird übersprungen.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation ist nicht installiert; Validator-Code-Generierung wird übersprungen.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation ist nicht aktiviert; Validator-Code-Generierung wird übersprungen.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>webman/validation-Middleware ist nicht aktiviert; Validator-Code-Generierung wird übersprungen.</comment>',
            'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Eingabe Standard: Y)</question>\n",
            'crud_generated' => '<info>{count} Datei(en) erzeugt:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Nichts erzeugt.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Validator-Generierung fehlgeschlagen: {reason}. Leerer Validator wurde erzeugt.',
            'db_unavailable' => '<comment>[Warning]</comment> Datenbank nicht erreichbar oder keine Berechtigung. Es wird mit interaktiver Auswahl oder leerem Modell fortgefahren.',
            'table_list_failed' => '<comment>[Warning]</comment> Tabellenliste konnte nicht geladen werden. Es wird mit interaktiver Auswahl oder leerem Modell fortgefahren.',
            'db_connect_failed' => '<error>Datenbankverbindung fehlgeschlagen. Prüfen Sie {configPath}.</error>',
            'db_permission_denied' => '<error>Datenbankbenutzer {user} hat keine Berechtigung, das Schema von {database} zu lesen.{hint}</error>',
            'db_permission_denied_hint' => ' Versuchen Sie -t zur Tabellenangabe.',
            'no_match' => '<comment>[Info]</comment> Keine Tabelle entspricht dem Modellnamen nach Konvention.',
            'prompt_help' => '<comment>[Info]</comment> Nummer eingeben zum Auswählen, Tabellenname eingeben, Enter für mehr, 0 für leeres Modell, /Schlüsselwort zum Filtern (/ zum Löschen).',
            'no_more' => '<comment>[Info]</comment> Keine weiteren Tabellen.',
            'end_of_list' => '<comment>[Info]</comment> Listenende. Tabellenname, Nummer, 0 für leer oder /Schlüsselwort eingeben.',
            'filter_cleared' => '<comment>[Info]</comment> Filter gelöscht.',
            'filter_applied' => '<comment>[Info]</comment> Filter angewendet: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Keine Tabelle entspricht dem Filter `{keyword}`. / zum Löschen oder anderes Schlüsselwort.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Auswahl außerhalb des Bereichs. Enter für mehr oder gültige Nummer wählen.',
            'table_not_in_list' => '<comment>[Warning]</comment> Tabelle `{table}` ist nicht in der aktuellen Liste. Es wird trotzdem versucht zu erzeugen (Schema-Annotationen können leer sein).',
            'showing_range' => '<comment>[Info]</comment> Anzeige {start}-{end} (insgesamt {shown}).',
            'connection_not_found' => '<error>Datenbankverbindung nicht gefunden: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> hat keine konfigurierte Verbindung: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Verbindung passt nicht zum Plugin: plugin=</error> <comment>{plugin}</comment> <error>, verbindung=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Ungültige Standardverbindung für Plugin {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => '{label} eingeben (Enter für Standard: {default}): ',
            'enter_path_prompt' => '{label}-Pfad eingeben (Enter für Standard: {default}): ',
            'invalid_name' => '<error>Ungültiger {type}-Name.</error>',
            'plugin_path_mismatch' => '<error>Plugin und Pfad stimmen nicht überein: --plugin={plugin}, aber aus Pfad abgeleitet: {path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin und Pfad stimmen nicht überein: --plugin={plugin}, aus Pfad: {path_plugin}</question>\n<question>Mit --plugin fortfahren? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Bitte Plugin-Namen erneut eingeben [{default}]: ',
            'reference_only' => 'Hinweis: Generierter Code dient nur als Referenz; bitte an Ihre Geschäftslogik anpassen.',
            'opt_table' => 'Tabellenname. z.B. users',
            'opt_model' => 'Modellname. z.B. User, admin/User',
            'opt_model_path' => 'Modellpfad (relativ). z.B. plugin/admin/app/model',
            'opt_controller' => 'Controller-Name. z.B. UserController, admin/UserController',
            'opt_controller_path' => 'Controller-Pfad (relativ). z.B. plugin/admin/app/controller',
            'opt_validator' => 'Validator-Name. z.B. UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Validator-Pfad (relativ). z.B. plugin/admin/app/validation',
            'opt_plugin' => 'Plugin-Name unter plugin/. z.B. admin',
            'opt_orm' => 'ORM wählen: laravel|thinkorm',
            'opt_database' => 'Datenbankverbindung wählen.',
            'opt_force' => 'Vorhandene Dateien ohne Nachfrage überschreiben.',
            'opt_no_validator' => 'Keinen Validator erzeugen.',
            'opt_no_interaction' => 'Interaktiven Modus deaktivieren.',
        ];

        $es = [
            'invalid_plugin' => '<error>Nombre de plugin inválido: {plugin}. `--plugin/-p` debe ser un nombre de directorio bajo plugin/ y no puede contener / ni \\.</error>',
            'invalid_path' => '<error>Ruta inválida: </error> <comment>{path}</comment> <error>. La ruta debe ser relativa (al directorio raíz del proyecto), no absoluta.</error>',
            'table_required' => '<error>Se requiere la tabla. Proporcione --table o selecciónela de forma interactiva.</error>',
            'validation_not_enabled' => '<error>webman/validation no está habilitado o instalado; se omite la generación del validador.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation no está instalado; se omite la generación de código del validador.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation no está habilitado; se omite la generación de código del validador.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>El middleware de webman/validation no está habilitado; se omite la generación de código del validador.</comment>',
            'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Se generaron {count} archivo(s):</info>',
            'nothing_generated' => '<comment>[Warning]</comment> No se generó nada.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Error al generar el validador: {reason}. Se generó un validador vacío.',
            'db_unavailable' => '<comment>[Warning]</comment> Base de datos no accesible o sin permiso. Se continuará con selección interactiva o modelo vacío.',
            'table_list_failed' => '<comment>[Warning]</comment> No se pudo obtener la lista de tablas. Se continuará con selección interactiva o modelo vacío.',
            'db_connect_failed' => '<error>No se puede conectar a la base de datos. Compruebe {configPath}.</error>',
            'db_permission_denied' => '<error>El usuario {user} no tiene permiso para leer el esquema de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Use -t para especificar una tabla.',
            'no_match' => '<comment>[Info]</comment> Ninguna tabla coincide con el nombre del modelo por convención.',
            'prompt_help' => '<comment>[Info]</comment> Introduzca un número para seleccionar, escriba un nombre de tabla, Enter para más, 0 para modelo vacío, o /palabra para filtrar (/ para limpiar).',
            'no_more' => '<comment>[Info]</comment> No hay más tablas que mostrar.',
            'end_of_list' => '<comment>[Info]</comment> Fin de lista. Escriba nombre de tabla, número, 0 para vacío o /palabra.',
            'filter_cleared' => '<comment>[Info]</comment> Filtro borrado.',
            'filter_applied' => '<comment>[Info]</comment> Filtro aplicado: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Ninguna tabla coincide con el filtro `{keyword}`. Use / para limpiar u otra palabra.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Selección fuera de rango. Enter para más o elija un número válido.',
            'table_not_in_list' => '<comment>[Warning]</comment> La tabla `{table}` no está en la lista actual. Se intentará generar de todos modos (las anotaciones pueden estar vacías).',
            'showing_range' => '<comment>[Info]</comment> Mostrando {start}-{end} (total mostrado: {shown}).',
            'connection_not_found' => '<error>Conexión a la base de datos no encontrada: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>El plugin </error> <comment>{plugin}</comment> <error> no tiene conexión configurada: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>La conexión no coincide con el plugin: plugin=</error> <comment>{plugin}</comment> <error>, conexión=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Conexión por defecto inválida para el plugin {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Introduzca {label} (Enter para defecto: {default}): ',
            'enter_path_prompt' => 'Introduzca la ruta de {label} (Enter para defecto: {default}): ',
            'invalid_name' => '<error>Nombre de {type} inválido.</error>',
            'plugin_path_mismatch' => '<error>Plugin y ruta no coinciden: --plugin={plugin}, pero plugin inferido de ruta={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin y ruta no coinciden: --plugin={plugin}, inferido de ruta={path_plugin}</question>\n<question>¿Continuar usando --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Vuelva a introducir el nombre del plugin [{default}]: ',
            'reference_only' => 'Nota: el código generado es solo de referencia; complételo según su lógica de negocio.',
            'opt_table' => 'Nombre de tabla. ej. users',
            'opt_model' => 'Nombre del modelo. ej. User, admin/User',
            'opt_model_path' => 'Ruta del modelo (relativa). ej. plugin/admin/app/model',
            'opt_controller' => 'Nombre del controlador. ej. UserController, admin/UserController',
            'opt_controller_path' => 'Ruta del controlador (relativa). ej. plugin/admin/app/controller',
            'opt_validator' => 'Nombre del validador. ej. UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Ruta del validador (relativa). ej. plugin/admin/app/validation',
            'opt_plugin' => 'Nombre del plugin bajo plugin/. ej. admin',
            'opt_orm' => 'Seleccionar ORM: laravel|thinkorm',
            'opt_database' => 'Seleccionar conexión a la base de datos.',
            'opt_force' => 'Sobrescribir archivos existentes sin confirmación.',
            'opt_no_validator' => 'No generar validador.',
            'opt_no_interaction' => 'Desactivar modo interactivo.',
        ];

        $ptBr = [
            'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de diretório sob plugin/ e não pode conter / ou \\.</error>',
            'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. O caminho deve ser relativo (à raiz do projeto), não absoluto.</error>',
            'table_required' => '<error>Tabela é obrigatória. Forneça --table ou selecione interativamente.</error>',
            'validation_not_enabled' => '<error>webman/validation não está habilitado ou instalado; geração do validador ignorada.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation não está instalado; geração de código do validador ignorada.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation não está habilitado; geração de código do validador ignorada.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>O middleware webman/validation não está habilitado; geração de código do validador ignorada.</comment>',
            'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Gerado(s) {count} arquivo(s):</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Nada foi gerado.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Falha na geração do validador: {reason}. Um validador vazio foi gerado.',
            'db_unavailable' => '<comment>[Warning]</comment> Banco de dados inacessível ou sem permissão. Continuando com seleção interativa ou modelo vazio.',
            'table_list_failed' => '<comment>[Warning]</comment> Não foi possível obter a lista de tabelas. Continuando com seleção interativa ou modelo vazio.',
            'db_connect_failed' => '<error>Não foi possível conectar ao banco de dados. Verifique {configPath}.</error>',
            'db_permission_denied' => '<error>O usuário {user} não tem permissão para ler o esquema de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Use -t para especificar uma tabela.',
            'no_match' => '<comment>[Info]</comment> Nenhuma tabela corresponde ao nome do modelo por convenção.',
            'prompt_help' => '<comment>[Info]</comment> Digite um número para selecionar, digite um nome de tabela, Enter para mais, 0 para modelo vazio, ou /palavra para filtrar (/ para limpar).',
            'no_more' => '<comment>[Info]</comment> Não há mais tabelas para mostrar.',
            'end_of_list' => '<comment>[Info]</comment> Fim da lista. Digite nome da tabela, número, 0 para vazio ou /palavra.',
            'filter_cleared' => '<comment>[Info]</comment> Filtro limpo.',
            'filter_applied' => '<comment>[Info]</comment> Filtro aplicado: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Nenhuma tabela corresponde ao filtro `{keyword}`. Use / para limpar ou outra palavra.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Seleção fora do intervalo. Enter para mais ou escolha um número válido.',
            'table_not_in_list' => '<comment>[Warning]</comment> A tabela `{table}` não está na lista atual. Será tentada a geração mesmo assim (anotações podem estar vazias).',
            'showing_range' => '<comment>[Info]</comment> Mostrando {start}-{end} (total mostrado: {shown}).',
            'connection_not_found' => '<error>Conexão com o banco de dados não encontrada: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>O plugin </error> <comment>{plugin}</comment> <error> não tem conexão configurada: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>A conexão não corresponde ao plugin: plugin=</error> <comment>{plugin}</comment> <error>, conexão=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Conexão padrão inválida para o plugin {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Digite {label} (Enter para padrão: {default}): ',
            'enter_path_prompt' => 'Digite o caminho de {label} (Enter para padrão: {default}): ',
            'invalid_name' => '<error>Nome de {type} inválido.</error>',
            'plugin_path_mismatch' => '<error>Plugin e caminho não coincidem: --plugin={plugin}, mas plugin inferido do caminho={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin e caminho não coincidem: --plugin={plugin}, inferido do caminho={path_plugin}</question>\n<question>Continuar usando --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Digite novamente o nome do plugin [{default}]: ',
            'reference_only' => 'Nota: o código gerado é apenas de referência; complete conforme sua lógica de negócio.',
            'opt_table' => 'Nome da tabela. ex: users',
            'opt_model' => 'Nome do modelo. ex: User, admin/User',
            'opt_model_path' => 'Caminho do modelo (relativo). ex: plugin/admin/app/model',
            'opt_controller' => 'Nome do controlador. ex: UserController, admin/UserController',
            'opt_controller_path' => 'Caminho do controlador (relativo). ex: plugin/admin/app/controller',
            'opt_validator' => 'Nome do validador. ex: UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Caminho do validador (relativo). ex: plugin/admin/app/validation',
            'opt_plugin' => 'Nome do plugin sob plugin/. ex: admin',
            'opt_orm' => 'Selecionar ORM: laravel|thinkorm',
            'opt_database' => 'Selecionar conexão com o banco de dados.',
            'opt_force' => 'Sobrescrever arquivos existentes sem confirmação.',
            'opt_no_validator' => 'Não gerar validador.',
            'opt_no_interaction' => 'Desativar modo interativo.',
        ];

        $ru = [
            'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/ и не должно содержать / или \\.</error>',
            'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. Путь должен быть относительным (к корню проекта), не абсолютным.</error>',
            'table_required' => '<error>Требуется таблица. Укажите --table или выберите в интерактивном режиме.</error>',
            'validation_not_enabled' => '<error>webman/validation не включён или не установлен; генерация валидатора пропущена.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation не установлен; генерация кода валидатора пропущена.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation не включён; генерация кода валидатора пропущена.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>Промежуточное ПО webman/validation не включено; генерация кода валидатора пропущена.</comment>',
            'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Создано файлов: {count}</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Ничего не создано.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Ошибка генерации валидатора: {reason}. Создан пустой валидатор.',
            'db_unavailable' => '<comment>[Warning]</comment> База данных недоступна или нет прав. Продолжение с интерактивным выбором или пустой моделью.',
            'table_list_failed' => '<comment>[Warning]</comment> Не удалось получить список таблиц. Продолжение с интерактивным выбором или пустой моделью.',
            'db_connect_failed' => '<error>Не удалось подключиться к базе данных. Проверьте {configPath}.</error>',
            'db_permission_denied' => '<error>Пользователь {user} не имеет права читать схему {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Используйте -t для указания таблицы.',
            'no_match' => '<comment>[Info]</comment> Нет таблицы, соответствующей имени модели по соглашению.',
            'prompt_help' => '<comment>[Info]</comment> Введите номер для выбора, имя таблицы, Enter — ещё, 0 — пустая модель, /ключ — фильтр (/ — сброс).',
            'no_more' => '<comment>[Info]</comment> Больше таблиц нет.',
            'end_of_list' => '<comment>[Info]</comment> Конец списка. Введите имя таблицы, номер, 0 для пустой или /ключ.',
            'filter_cleared' => '<comment>[Info]</comment> Фильтр сброшен.',
            'filter_applied' => '<comment>[Info]</comment> Применён фильтр: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Нет таблиц по фильтру `{keyword}`. Введите / для сброса или другое слово.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Номер вне диапазона. Enter — ещё или выберите допустимый номер.',
            'table_not_in_list' => '<comment>[Warning]</comment> Таблица `{table}` не в текущем списке. Всё равно будет попытка генерации (аннотации могут быть пустыми).',
            'showing_range' => '<comment>[Info]</comment> Показано {start}-{end} (всего {shown}).',
            'connection_not_found' => '<error>Подключение к БД не найдено: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>У плагина </error> <comment>{plugin}</comment> <error> не настроено подключение: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Подключение не соответствует плагину: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Недопустимое подключение по умолчанию для плагина {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Введите {label} (Enter — по умолчанию {default}): ',
            'enter_path_prompt' => 'Введите путь {label} (Enter — по умолчанию {default}): ',
            'invalid_name' => '<error>Недопустимое имя: {type}.</error>',
            'plugin_path_mismatch' => '<error>Плагин и путь не совпадают: --plugin={plugin}, по пути получен плагин={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Плагин и путь не совпадают: --plugin={plugin}, по пути: {path_plugin}</question>\n<question>Продолжить с --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Введите имя плагина снова [{default}]: ',
            'reference_only' => 'Подсказка: сгенерированный код только для справки; доработайте под свою логику.',
            'opt_table' => 'Имя таблицы. напр. users',
            'opt_model' => 'Имя модели. напр. User, admin/User',
            'opt_model_path' => 'Путь модели (относительный). напр. plugin/admin/app/model',
            'opt_controller' => 'Имя контроллера. напр. UserController, admin/UserController',
            'opt_controller_path' => 'Путь контроллера (относительный). напр. plugin/admin/app/controller',
            'opt_validator' => 'Имя валидатора. напр. UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Путь валидатора (относительный). напр. plugin/admin/app/validation',
            'opt_plugin' => 'Имя плагина в plugin/. напр. admin',
            'opt_orm' => 'Выбрать ORM: laravel|thinkorm',
            'opt_database' => 'Выбрать подключение к БД.',
            'opt_force' => 'Перезаписывать существующие файлы без подтверждения.',
            'opt_no_validator' => 'Не создавать валидатор.',
            'opt_no_interaction' => 'Отключить интерактивный режим.',
        ];

        $vi = [
            'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/ và không được chứa / hoặc \\.</error>',
            'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. Đường dẫn phải tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>',
            'table_required' => '<error>Bảng là bắt buộc. Cung cấp --table hoặc chọn tương tác.</error>',
            'validation_not_enabled' => '<error>webman/validation chưa bật hoặc chưa cài; bỏ qua tạo validator.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation chưa cài đặt; bỏ qua tạo mã validator.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation chưa bật; bỏ qua tạo mã validator.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>Middleware webman/validation chưa bật; bỏ qua tạo mã validator.</comment>',
            'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Đã tạo {count} tệp:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Không tạo gì.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Tạo validator thất bại: {reason}. Đã tạo validator rỗng.',
            'db_unavailable' => '<comment>[Warning]</comment> Không truy cập được cơ sở dữ liệu hoặc không có quyền. Tiếp tục với chọn tương tác hoặc model rỗng.',
            'table_list_failed' => '<comment>[Warning]</comment> Không lấy được danh sách bảng. Tiếp tục với chọn tương tác hoặc model rỗng.',
            'db_connect_failed' => '<error>Không thể kết nối cơ sở dữ liệu. Kiểm tra cấu hình {configPath}.</error>',
            'db_permission_denied' => '<error>Người dùng {user} không có quyền đọc schema của {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Dùng -t để chỉ định bảng.',
            'no_match' => '<comment>[Info]</comment> Không có bảng nào khớp tên model theo quy ước.',
            'prompt_help' => '<comment>[Info]</comment> Nhập số để chọn, gõ tên bảng, Enter để xem thêm, 0 cho model rỗng, /từ khóa để lọc (/ để xóa).',
            'no_more' => '<comment>[Info]</comment> Không còn bảng nào.',
            'end_of_list' => '<comment>[Info]</comment> Hết danh sách. Gõ tên bảng, số, 0 cho rỗng hoặc /từ khóa.',
            'filter_cleared' => '<comment>[Info]</comment> Đã xóa bộ lọc.',
            'filter_applied' => '<comment>[Info]</comment> Đã áp dụng bộ lọc: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Không có bảng khớp bộ lọc `{keyword}`. Dùng / để xóa hoặc từ khóa khác.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Lựa chọn ngoài phạm vi. Enter để xem thêm hoặc chọn số hợp lệ.',
            'table_not_in_list' => '<comment>[Warning]</comment> Bảng `{table}` không có trong danh sách hiện tại. Vẫn sẽ thử tạo (chú thích có thể trống).',
            'showing_range' => '<comment>[Info]</comment> Đang hiển thị {start}-{end} (tổng {shown}).',
            'connection_not_found' => '<error>Không tìm thấy kết nối cơ sở dữ liệu: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> chưa cấu hình kết nối: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Kết nối không khớp plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Kết nối mặc định không hợp lệ cho plugin {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Nhập {label} (Enter mặc định: {default}): ',
            'enter_path_prompt' => 'Nhập đường dẫn {label} (Enter mặc định: {default}): ',
            'invalid_name' => '<error>Tên {type} không hợp lệ.</error>',
            'plugin_path_mismatch' => '<error>Plugin và đường dẫn không khớp: --plugin={plugin}, nhưng suy ra từ đường dẫn={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin và đường dẫn không khớp: --plugin={plugin}, suy ra từ đường dẫn={path_plugin}</question>\n<question>Tiếp tục dùng --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Vui lòng nhập lại tên plugin [{default}]: ',
            'reference_only' => 'Lưu ý: mã tạo ra chỉ để tham khảo; hoàn thiện theo nghiệp vụ thực tế.',
            'opt_table' => 'Tên bảng. vd: users',
            'opt_model' => 'Tên model. vd: User, admin/User',
            'opt_model_path' => 'Đường dẫn model (tương đối). vd: plugin/admin/app/model',
            'opt_controller' => 'Tên controller. vd: UserController, admin/UserController',
            'opt_controller_path' => 'Đường dẫn controller (tương đối). vd: plugin/admin/app/controller',
            'opt_validator' => 'Tên validator. vd: UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Đường dẫn validator (tương đối). vd: plugin/admin/app/validation',
            'opt_plugin' => 'Tên plugin trong plugin/. vd: admin',
            'opt_orm' => 'Chọn ORM: laravel|thinkorm',
            'opt_database' => 'Chọn kết nối cơ sở dữ liệu.',
            'opt_force' => 'Ghi đè tệp đã tồn tại không cần xác nhận.',
            'opt_no_validator' => 'Không tạo validator.',
            'opt_no_interaction' => 'Tắt chế độ tương tác.',
        ];

        $tr = [
            'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altındaki bir dizin adı olmalı, / veya \\ içermemeli.</error>',
            'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. Yol proje köküne göre göreli olmalı, mutlak olmamalı.</error>',
            'table_required' => '<error>Tablo gerekli. --table verin veya etkileşimli seçin.</error>',
            'validation_not_enabled' => '<error>webman/validation etkin değil veya yüklü değil; doğrulayıcı oluşturma atlanıyor.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation yüklü değil; doğrulayıcı kod oluşturma atlanıyor.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation etkin değil; doğrulayıcı kod oluşturma atlanıyor.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>webman/validation ara katmanı etkin değil; doğrulayıcı kod oluşturma atlanıyor.</comment>',
            'override_prompt' => "<question>Dosya zaten var: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>{count} dosya oluşturuldu:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Hiçbir şey oluşturulmadı.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Doğrulayıcı oluşturma başarısız: {reason}. Boş doğrulayıcı oluşturuldu.',
            'db_unavailable' => '<comment>[Warning]</comment> Veritabanına erişilemiyor veya izin yok. Etkileşimli seçim veya boş model ile devam ediliyor.',
            'table_list_failed' => '<comment>[Warning]</comment> Tablo listesi alınamadı. Etkileşimli seçim veya boş model ile devam ediliyor.',
            'db_connect_failed' => '<error>Veritabanına bağlanılamıyor. {configPath} yapılandırmasını kontrol edin.</error>',
            'db_permission_denied' => '<error>{user} kullanıcısının {database} şemasını okuma izni yok.{hint}</error>',
            'db_permission_denied_hint' => ' Tablo belirtmek için -t kullanmayı deneyin.',
            'no_match' => '<comment>[Info]</comment> Kurala göre model adıyla eşleşen tablo yok.',
            'prompt_help' => '<comment>[Info]</comment> Seçmek için numara girin, tablo adı yazın, daha fazla için Enter, boş model için 0, filtre için /anahtar (/ temizler).',
            'no_more' => '<comment>[Info]</comment> Gösterilecek başka tablo yok.',
            'end_of_list' => '<comment>[Info]</comment> Listenin sonu. Tablo adı, numara, 0 (boş) veya /anahtar girin.',
            'filter_cleared' => '<comment>[Info]</comment> Filtre temizlendi.',
            'filter_applied' => '<comment>[Info]</comment> Filtre uygulandı: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> `{keyword}` filtresiyle eşleşen tablo yok. Temizlemek için / veya başka anahtar kullanın.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Seçim aralık dışı. Daha fazla için Enter veya geçerli numara seçin.',
            'table_not_in_list' => '<comment>[Warning]</comment> `{table}` tablosu mevcut listede yok. Yine de oluşturulacak (şema açıklamaları boş olabilir).',
            'showing_range' => '<comment>[Info]</comment> {start}-{end} gösteriliyor (toplam {shown}).',
            'connection_not_found' => '<error>Veritabanı bağlantısı bulunamadı: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error></error> <comment>{plugin}</comment> <error> eklentisinde bağlantı yapılandırılmamış: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Bağlantı eklentiyle eşleşmiyor: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error></error> <comment>{plugin}</comment> <error> eklentisi için varsayılan bağlantı geçersiz: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => '{label} girin (Varsayılan: {default}, Enter): ',
            'enter_path_prompt' => '{label} yolu girin (Varsayılan: {default}, Enter): ',
            'invalid_name' => '<error>Geçersiz {type} adı.</error>',
            'plugin_path_mismatch' => '<error>Eklenti ve yol uyuşmuyor: --plugin={plugin}, ancak yoldan çıkarılan={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Eklenti ve yol uyuşmuyor: --plugin={plugin}, yoldan={path_plugin}</question>\n<question>--plugin ile devam? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Eklenti adını tekrar girin [{default}]: ',
            'reference_only' => 'Not: Oluşturulan kod yalnızca referans içindir; iş mantığınıza göre tamamlayın.',
            'opt_table' => 'Tablo adı. örn: users',
            'opt_model' => 'Model adı. örn: User, admin/User',
            'opt_model_path' => 'Model yolu (göreli). örn: plugin/admin/app/model',
            'opt_controller' => 'Controller adı. örn: UserController, admin/UserController',
            'opt_controller_path' => 'Controller yolu (göreli). örn: plugin/admin/app/controller',
            'opt_validator' => 'Doğrulayıcı adı. örn: UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Doğrulayıcı yolu (göreli). örn: plugin/admin/app/validation',
            'opt_plugin' => 'plugin/ altında eklenti adı. örn: admin',
            'opt_orm' => 'ORM seçin: laravel|thinkorm',
            'opt_database' => 'Veritabanı bağlantısı seçin.',
            'opt_force' => 'Mevcut dosyaları onay almadan üzerine yaz.',
            'opt_no_validator' => 'Doğrulayıcı oluşturma.',
            'opt_no_interaction' => 'Etkileşimli modu kapat.',
        ];

        $id = [
            'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama direktori di bawah plugin/ dan tidak boleh berisi / atau \\.</error>',
            'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. Path harus relatif (ke root proyek), bukan absolut.</error>',
            'table_required' => '<error>Tabel wajib. Berikan --table atau pilih secara interaktif.</error>',
            'validation_not_enabled' => '<error>webman/validation tidak diaktifkan atau tidak terpasang; pembuatan validator dilewati.</error>',
            'validation_not_installed_skip' => '<comment>webman/validation tidak terpasang; pembuatan kode validator dilewati.</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation tidak diaktifkan; pembuatan kode validator dilewati.</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>Middleware webman/validation tidak diaktifkan; pembuatan kode validator dilewati.</comment>',
            'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>Berhasil membuat {count} file:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> Tidak ada yang dibuat.',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> Gagal membuat validator: {reason}. Validator kosong telah dibuat.',
            'db_unavailable' => '<comment>[Warning]</comment> Database tidak dapat diakses atau tidak ada izin. Melanjutkan dengan pilihan interaktif atau model kosong.',
            'table_list_failed' => '<comment>[Warning]</comment> Tidak bisa mengambil daftar tabel. Melanjutkan dengan pilihan interaktif atau model kosong.',
            'db_connect_failed' => '<error>Tidak dapat terhubung ke database. Periksa konfigurasi {configPath}.</error>',
            'db_permission_denied' => '<error>Pengguna {user} tidak memiliki izin membaca skema {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Coba gunakan -t untuk menentukan tabel.',
            'no_match' => '<comment>[Info]</comment> Tidak ada tabel yang cocok dengan nama model menurut konvensi.',
            'prompt_help' => '<comment>[Info]</comment> Masukkan nomor untuk memilih, ketik nama tabel, Enter untuk lebih banyak, 0 untuk model kosong, atau /kata untuk filter (/ untuk hapus).',
            'no_more' => '<comment>[Info]</comment> Tidak ada tabel lagi untuk ditampilkan.',
            'end_of_list' => '<comment>[Info]</comment> Akhir daftar. Ketik nama tabel, nomor, 0 untuk kosong, atau /kata.',
            'filter_cleared' => '<comment>[Info]</comment> Filter dihapus.',
            'filter_applied' => '<comment>[Info]</comment> Filter diterapkan: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Tidak ada tabel yang cocok filter `{keyword}`. Gunakan / untuk hapus atau kata lain.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Pilihan di luar jangkauan. Enter untuk lebih banyak atau pilih nomor yang valid.',
            'table_not_in_list' => '<comment>[Warning]</comment> Tabel `{table}` tidak ada di daftar saat ini. Akan tetap dicoba buat (anotasi skema bisa kosong).',
            'showing_range' => '<comment>[Info]</comment> Menampilkan {start}-{end} (total {shown}).',
            'connection_not_found' => '<error>Koneksi database tidak ditemukan: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> tidak punya koneksi yang dikonfigurasi: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Koneksi tidak cocok dengan plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Koneksi default tidak valid untuk plugin {plugin}: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'Masukkan {label} (Enter untuk default: {default}): ',
            'enter_path_prompt' => 'Masukkan path {label} (Enter untuk default: {default}): ',
            'invalid_name' => '<error>Nama {type} tidak valid.</error>',
            'plugin_path_mismatch' => '<error>Plugin dan path tidak cocok: --plugin={plugin}, tetapi dari path={path_plugin}.</error>',
            'plugin_path_mismatch_confirm' => "<question>Plugin dan path tidak cocok: --plugin={plugin}, dari path={path_plugin}</question>\n<question>Lanjutkan pakai --plugin? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'Silakan masukkan lagi nama plugin [{default}]: ',
            'reference_only' => 'Catatan: Kode yang dibuat hanya referensi; lengkapi sesuai logika bisnis Anda.',
            'opt_table' => 'Nama tabel. mis: users',
            'opt_model' => 'Nama model. mis: User, admin/User',
            'opt_model_path' => 'Path model (relatif). mis: plugin/admin/app/model',
            'opt_controller' => 'Nama controller. mis: UserController, admin/UserController',
            'opt_controller_path' => 'Path controller (relatif). mis: plugin/admin/app/controller',
            'opt_validator' => 'Nama validator. mis: UserValidator, admin/UserValidator',
            'opt_validator_path' => 'Path validator (relatif). mis: plugin/admin/app/validation',
            'opt_plugin' => 'Nama plugin di plugin/. mis: admin',
            'opt_orm' => 'Pilih ORM: laravel|thinkorm',
            'opt_database' => 'Pilih koneksi database.',
            'opt_force' => 'Timpa file yang ada tanpa konfirmasi.',
            'opt_no_validator' => 'Jangan buat validator.',
            'opt_no_interaction' => 'Nonaktifkan mode interaktif.',
        ];

        $th = [
            'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ และห้ามมี / หรือ \\</error>',
            'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่แบบสัมบูรณ์</error>',
            'table_required' => '<error>ต้องระบุตาราง ให้ใช้ --table หรือเลือกแบบโต้ตอบ</error>',
            'validation_not_enabled' => '<error>webman/validation ยังไม่ได้เปิดใช้หรือยังไม่ได้ติดตั้ง จะข้ามการสร้างตัวตรวจสอบ</error>',
            'validation_not_installed_skip' => '<comment>ยังไม่ได้ติดตั้ง webman/validation จะข้ามการสร้างโค้ดตัวตรวจสอบ</comment>',
            'validation_not_enabled_skip' => '<comment>webman/validation ยังไม่ได้เปิดใช้ จะข้ามการสร้างโค้ดตัวตรวจสอบ</comment>',
            'validation_middleware_not_enabled_skip' => '<comment>ยังไม่ได้เปิดใช้ middleware ของ webman/validation จะข้ามการสร้างโค้ดตัวตรวจสอบ</comment>',
            'override_prompt' => "<question>มีไฟล์อยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n",
            'crud_generated' => '<info>สร้างแล้ว {count} ไฟล์:</info>',
            'nothing_generated' => '<comment>[Warning]</comment> ไม่ได้สร้างอะไร',
            'created' => '{path}',
            'validator_failed' => '<comment>[Warning]</comment> สร้างตัวตรวจสอบไม่สำเร็จ: {reason} ได้สร้างตัวตรวจสอบว่างไว้',
            'db_unavailable' => '<comment>[Warning]</comment> เข้าถึงฐานข้อมูลไม่ได้หรือไม่มีสิทธิ์ จะใช้การเลือกแบบโต้ตอบหรือโมเดลว่าง',
            'table_list_failed' => '<comment>[Warning]</comment> ดึงรายการตารางไม่ได้ จะใช้การเลือกแบบโต้ตอบหรือโมเดลว่าง',
            'db_connect_failed' => '<error>ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า {configPath}</error>',
            'db_permission_denied' => '<error>ผู้ใช้ {user} ไม่มีสิทธิ์อ่านโครงสร้างตารางของ {database}{hint}</error>',
            'db_permission_denied_hint' => ' ลองใช้ -t เพื่อระบุตาราง',
            'no_match' => '<comment>[Info]</comment> ไม่มีตารางที่ตรงกับชื่อโมเดลตามธรรมเนียม',
            'prompt_help' => '<comment>[Info]</comment> พิมพ์เลขเพื่อเลือก ชื่อตาราง Enter เพื่อดูเพิ่ม 0 สำหรับโมเดลว่าง /คำ สำหรับกรอง (/ เพื่อล้าง)',
            'no_more' => '<comment>[Info]</comment> ไม่มีตารางเพิ่มให้แสดง',
            'end_of_list' => '<comment>[Info]</comment> จบรายการ พิมพ์ชื่อตาราง เลข 0 สำหรับว่าง หรือ /คำ',
            'filter_cleared' => '<comment>[Info]</comment> ล้างตัวกรองแล้ว',
            'filter_applied' => '<comment>[Info]</comment> ใช้ตัวกรอง: `{keyword}`',
            'filter_no_match' => '<comment>[Warning]</comment> ไม่มีตารางตรงกับตัวกรอง `{keyword}` ใช้ / เพื่อล้างหรือคำอื่น',
            'selection_out_of_range' => '<comment>[Warning]</comment> เลือกนอกช่วง Enter เพื่อดูเพิ่ม หรือเลือกเลขที่ถูกต้อง',
            'table_not_in_list' => '<comment>[Warning]</comment> ตาราง `{table}` ไม่อยู่ในรายการปัจจุบัน จะลองสร้างอยู่ดี (คำอธิบายอาจว่าง)',
            'showing_range' => '<comment>[Info]</comment> แสดง {start}-{end} (รวม {shown})',
            'connection_not_found' => '<error>ไม่พบการเชื่อมต่อฐานข้อมูล: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>ปลั๊กอิน </error> <comment>{plugin}</comment> <error> ไม่มีการกำหนดการเชื่อมต่อ: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>การเชื่อมต่อไม่ตรงกับปลั๊กอิน: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>การเชื่อมต่อเริ่มต้นของปลั๊กอิน </error> <comment>{plugin}</comment> <error> ไม่ถูกต้อง: </error> <comment>{connection}</comment>',
            'enter_name_prompt' => 'ใส่ {label} (Enter ค่าเริ่มต้น: {default}): ',
            'enter_path_prompt' => 'ใส่เส้นทาง {label} (Enter ค่าเริ่มต้น: {default}): ',
            'invalid_name' => '<error>ชื่อ {type} ไม่ถูกต้อง</error>',
            'plugin_path_mismatch' => '<error>ปลั๊กอินกับเส้นทางไม่ตรง: --plugin={plugin} แต่จากเส้นทาง={path_plugin}</error>',
            'plugin_path_mismatch_confirm' => "<question>ปลั๊กอินกับเส้นทางไม่ตรง: --plugin={plugin} จากเส้นทาง={path_plugin}</question>\n<question>ใช้ --plugin ต่อ? [Y/n] (Enter default: Y)</question>\n",
            'plugin_reinput_prompt' => 'กรุณาใส่ชื่อปลั๊กอินอีกครั้ง [{default}]: ',
            'reference_only' => 'หมายเหตุ: โค้ดที่สร้างเป็นเพียงตัวอย่าง กรุณาเติมให้ครบตามธุรกิจจริง',
            'opt_table' => 'ชื่อตาราง เช่น users',
            'opt_model' => 'ชื่อโมเดล เช่น User, admin/User',
            'opt_model_path' => 'เส้นทางโมเดล (สัมพัทธ์) เช่น plugin/admin/app/model',
            'opt_controller' => 'ชื่อคอนโทรลเลอร์ เช่น UserController, admin/UserController',
            'opt_controller_path' => 'เส้นทางคอนโทรลเลอร์ (สัมพัทธ์) เช่น plugin/admin/app/controller',
            'opt_validator' => 'ชื่อตัวตรวจสอบ เช่น UserValidator, admin/UserValidator',
            'opt_validator_path' => 'เส้นทางตัวตรวจสอบ (สัมพัทธ์) เช่น plugin/admin/app/validation',
            'opt_plugin' => 'ชื่อปลั๊กอินภายใต้ plugin/ เช่น admin',
            'opt_orm' => 'เลือก ORM: laravel|thinkorm',
            'opt_database' => 'เลือกการเชื่อมต่อฐานข้อมูล',
            'opt_force' => 'เขียนทับไฟล์ที่มีอยู่โดยไม่ยืนยัน',
            'opt_no_validator' => 'ไม่สร้างตัวตรวจสอบ',
            'opt_no_interaction' => 'ปิดโหมดโต้ตอบ',
        ];

        return [
            'zh_CN' => $zh,
            'zh_TW' => $zh,
            'en' => $en,
            'ja' => $ja,
            'ko' => $ko,
            'fr' => $fr,
            'de' => $de,
            'es' => $es,
            'pt_BR' => $ptBr,
            'ru' => $ru,
            'vi' => $vi,
            'tr' => $tr,
            'id' => $id,
            'th' => $th,
        ];
    }

    public static function getTypeLabels(): array
    {
        $enTypeLabels = [
            'model' => 'model name',
            'controller' => 'controller name',
            'validation' => 'validator',
            'validator' => 'validator name',
            'bootstrap' => 'bootstrap',
            'command' => 'command',
            'middleware' => 'middleware',
            'process' => 'process',
        ];
        return [
            'zh_CN' => ['model' => '模型名', 'controller' => '控制器名', 'validation' => '验证器', 'validator' => '验证器名', 'bootstrap' => '启动项', 'command' => '命令', 'middleware' => '中间件', 'process' => '进程'],
            'zh_TW' => ['model' => '模型名', 'controller' => '控制器名', 'validation' => '驗證器', 'validator' => '驗證器名', 'bootstrap' => '啟動項', 'command' => '命令', 'middleware' => '中間件', 'process' => '進程'],
            'en' => $enTypeLabels,
            'ja' => ['model' => 'モデル名', 'controller' => 'コントローラ名', 'validation' => 'バリデータ', 'validator' => 'バリデータ名', 'bootstrap' => 'ブートストラップ', 'command' => 'コマンド', 'middleware' => 'ミドルウェア', 'process' => 'プロセス'],
            'ko' => ['model' => '모델 이름', 'controller' => '컨트롤러 이름', 'validation' => '검증기', 'validator' => '검증기 이름', 'bootstrap' => '부트스트랩', 'command' => '명령', 'middleware' => '미들웨어', 'process' => '프로세스'],
            'fr' => ['model' => 'nom du modèle', 'controller' => 'nom du contrôleur', 'validation' => 'validateur', 'validator' => 'nom du validateur', 'bootstrap' => 'bootstrap', 'command' => 'commande', 'middleware' => 'middleware', 'process' => 'processus'],
            'de' => ['model' => 'Modellname', 'controller' => 'Controller-Name', 'validation' => 'Validator', 'validator' => 'Validator-Name', 'bootstrap' => 'Bootstrap', 'command' => 'Befehl', 'middleware' => 'Middleware', 'process' => 'Prozess'],
            'es' => ['model' => 'nombre del modelo', 'controller' => 'nombre del controlador', 'validation' => 'validador', 'validator' => 'nombre del validador', 'bootstrap' => 'bootstrap', 'command' => 'comando', 'middleware' => 'middleware', 'process' => 'proceso'],
            'pt_BR' => ['model' => 'nome do modelo', 'controller' => 'nome do controlador', 'validation' => 'validador', 'validator' => 'nome do validador', 'bootstrap' => 'bootstrap', 'command' => 'comando', 'middleware' => 'middleware', 'process' => 'processo'],
            'ru' => ['model' => 'имя модели', 'controller' => 'имя контроллера', 'validation' => 'валидатор', 'validator' => 'имя валидатора', 'bootstrap' => 'бутстрап', 'command' => 'команда', 'middleware' => 'middleware', 'process' => 'процесс'],
            'vi' => ['model' => 'tên model', 'controller' => 'tên controller', 'validation' => 'validator', 'validator' => 'tên validator', 'bootstrap' => 'bootstrap', 'command' => 'lệnh', 'middleware' => 'middleware', 'process' => 'quy trình'],
            'tr' => ['model' => 'model adı', 'controller' => 'denetleyici adı', 'validation' => 'doğrulayıcı', 'validator' => 'doğrulayıcı adı', 'bootstrap' => 'bootstrap', 'command' => 'komut', 'middleware' => 'middleware', 'process' => 'süreç'],
            'id' => ['model' => 'nama model', 'controller' => 'nama controller', 'validation' => 'validator', 'validator' => 'nama validator', 'bootstrap' => 'bootstrap', 'command' => 'perintah', 'middleware' => 'middleware', 'process' => 'proses'],
            'th' => ['model' => 'ชื่อโมเดล', 'controller' => 'ชื่อคอนโทรลเลอร์', 'validation' => 'ตัวตรวจสอบ', 'validator' => 'ชื่อตัวตรวจสอบ', 'bootstrap' => 'Bootstrap', 'command' => 'คำสั่ง', 'middleware' => 'Middleware', 'process' => 'กระบวนการ'],
        ];
    }

    public static function getValidatorPrompt(): array
    {
        return [
            'zh_CN' => '是否添加验证器？[Y/n] (回车默认 Y): ', 'zh_TW' => '是否加入驗證器？[Y/n] (Enter default: Y): ',
            'en' => 'Add validator? [Y/n] (Enter default: Y): ', 'ja' => 'バリデータを追加しますか？[Y/n] (Enter default: Y): ',
            'ko' => '검증기를 추가할까요? [Y/n] (Enter default: Y): ', 'fr' => 'Ajouter un validateur ? [Y/n] (Entrée par défaut: Y) : ',
            'de' => 'Validator hinzufügen? [Y/n] (Eingabe Standard: Y): ', 'es' => '¿Añadir validador? [Y/n] (Enter default: Y): ',
            'pt_BR' => 'Adicionar validador? [Y/n] (Enter default: Y): ', 'ru' => 'Добавить валидатор? [Y/n] (Enter default: Y): ',
            'vi' => 'Thêm trình xác thực? [Y/n] (Enter default: Y): ', 'tr' => 'Doğrulayıcı eklensin mi? [Y/n] (Enter default: Y): ',
            'id' => 'Tambahkan validator? [Y/n] (Enter default: Y): ', 'th' => 'เพิ่มตัวตรวจสอบ? [Y/n] (Enter default: Y): ',
        ];
    }

    public static function getMakeCrudHelpText(): array
    {
        $en = "Generate CRUD (Model, Controller, Validator).\n\nExamples:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction";
        return [
            'zh_CN' => "生成 CRUD（模型、控制器、验证器）。\n\n示例：\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'zh_TW' => "建立 CRUD（模型、控制器、驗證器）。\n\n範例：\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'en' => $en,
            'ja' => "CRUD（モデル、コントローラ、バリデータ）を生成。\n\n例：\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'ko' => "CRUD(모델, 컨트롤러, 검증기) 생성.\n\n예:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'fr' => "Générer CRUD (Modèle, Contrôleur, Validateur).\n\nExemples :\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'de' => "CRUD erzeugen (Modell, Controller, Validator).\n\nBeispiele:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'es' => "Generar CRUD (Modelo, Controlador, Validador).\n\nEjemplos:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'pt_BR' => "Gerar CRUD (Modelo, Controlador, Validador).\n\nExemplos:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'ru' => "Создать CRUD (Модель, Контроллер, Валидатор).\n\nПримеры:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'vi' => "Tạo CRUD (Model, Controller, Validator).\n\nVí dụ:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'tr' => "CRUD oluştur (Model, Controller, Validator).\n\nÖrnekler:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'id' => "Buat CRUD (Model, Controller, Validator).\n\nContoh:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
            'th' => "สร้าง CRUD (โมเดล, คอนโทรลเลอร์, ตัวตรวจสอบ).\n\nตัวอย่าง:\n  php webman make:crud\n  php webman make:crud --table=users\n  php webman make:crud --table=users --plugin=admin\n  php webman make:crud --table=users --no-validator\n  php webman make:crud --table=users --no-interaction",
        ];
    }

    public static function getMakeModelMessages(): array
    {
        $zh = [
            'make_model' => "<info>创建模型</info> <comment>{name}</comment>",
            'created' => '<info>已创建：</info> <comment>{path}</comment>',
            'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
            'enter_model_name_prompt' => "<question>输入模型（回车默认 {default}）：</question>\n",
            'enter_model_path_prompt' => "<question>输入模型路径（回车默认 {default}）：</question>\n",
            'name_required_non_interactive' => '<error>非交互模式下必须提供模型名参数，例如：php webman make:model User</error>',
            'invalid_name' => '<error>模型名无效。</error>',
            'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
            'connection_not_found' => '<error>数据库连接不存在：</error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>插件 </error> <comment>{plugin}</comment> <error> 未配置数据库连接：</error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>数据库连接与插件不匹配：当前插件=</error> <comment>{plugin}</comment> <error>，连接=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>插件 </error> <comment>{plugin}</comment> <error> 的默认数据库连接无效：</error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> 数据库不可用或无权限读取表信息，将生成空模型（可使用 -t/--table 指定）。',
            'table_list_failed' => '<comment>[Warning]</comment> 无法获取数据表列表，将生成空模型（可使用 -t/--table 指定）。',
            'db_connect_failed' => '<error>无法连接数据库，请检查 {configPath} 配置</error>',
            'db_permission_denied' => '<error>数据库用户{user}没有读取数据库{database}表结构权限{hint}</error>',
            'db_permission_denied_hint' => '，请尝试使用 -t 指定表名',
            'no_match' => '<comment>[Info]</comment> 未找到与模型名匹配的表（按约定推断失败）。',
            'prompt_help' => '<comment>[Info]</comment> 输入序号选择；输入表名；回车=更多；输入 0=空模型；输入 /关键字 过滤（输入 / 清除过滤）。',
            'no_more' => '<comment>[Info]</comment> 没有更多表可显示。',
            'end_of_list' => '<comment>[Info]</comment> 已到列表末尾。可输入表名、序号、0（空模型）或 /关键字。',
            'filter_cleared' => '<comment>[Info]</comment> 已清除过滤条件。',
            'filter_applied' => '<comment>[Info]</comment> 已应用过滤：`{keyword}`。',
            'filter_no_match' => '<comment>[Warning]</comment> 没有表匹配过滤 `{keyword}`。输入 / 清除过滤或换个关键字。',
            'selection_out_of_range' => '<comment>[Warning]</comment> 序号超出范围。可回车查看更多或输入有效序号。',
            'table_not_in_list' => '<comment>[Warning]</comment> 表 `{table}` 不在当前数据库列表中，将继续尝试生成（注释可能为空）。',
            'table_not_found_schema' => "<comment>[Warning]</comment> 表 `{table}` 未找到，将生成无注释的模型。",
            'table_not_found_empty' => '<comment>[Warning]</comment> 未找到数据表，将生成空模型（可使用 -t/--table 指定，交互终端下也可选择）。',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> 数据库不可用，将生成空模型。',
            'showing_range' => '<comment>[Info]</comment> 当前已显示 {start}-{end}（累计 {shown}）。',
        ];

        $en = [
            'make_model' => "<info>Create model</info> <comment>{name}</comment>",
            'created' => '<info>Created:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
            'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
            'connection_not_found' => '<error>Database connection not found: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> has no database connection configured: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Database connection does not match plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Invalid default database connection for plugin </error> <comment>{plugin}</comment> <error>: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Database is not accessible or permission denied. Generating an empty model (use -t/--table to specify).',
            'table_list_failed' => '<comment>[Warning]</comment> Unable to fetch table list. Generating an empty model (use -t/--table to specify).',
            'db_connect_failed' => '<error>Cannot connect to database. Check {configPath}.</error>',
            'db_permission_denied' => '<error>Database user {user} lacks permission to read schema for {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Try using -t to specify a table.',
            'no_match' => '<comment>[Info]</comment> No table matched the model name by convention.',
            'prompt_help' => '<comment>[Info]</comment> Enter a number to select, type a table name, press Enter for more, enter 0 for an empty model, or use /keyword to filter (use / to clear).',
            'no_more' => '<comment>[Info]</comment> No more tables to show.',
            'end_of_list' => '<comment>[Info]</comment> End of list. Type a table name, a number, 0 for empty, or /keyword.',
            'filter_cleared' => '<comment>[Info]</comment> Filter cleared.',
            'filter_applied' => '<comment>[Info]</comment> Filter applied: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> No tables matched filter `{keyword}`. Use / to clear or try another keyword.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Selection out of range. Press Enter for more, or choose a valid number.',
            'table_not_in_list' => '<comment>[Warning]</comment> Table `{table}` is not in the current database list. Will try to generate anyway (schema annotations may be empty).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Table `{table}` not found, generating model without schema annotations.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Table not found. Generating an empty model (use -t/--table to specify, or choose interactively in a supported terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Database is not accessible. Generating an empty model.',
            'showing_range' => '<comment>[Info]</comment> Showing {start}-{end} (total shown: {shown}).',
        ];

        $zhTW = [
            'make_model' => "<info>建立模型</info> <comment>{name}</comment>",
            'created' => '<info>已建立：</info> <comment>{path}</comment>',
            'override_prompt' => "<question>檔案已存在：{path}</question>\n<question>是否覆蓋？[Y/n]（Enter default: Y）</question>\n",
            'enter_model_name_prompt' => "<question>輸入模型（Enter 預設 {default}）：</question>\n",
            'enter_model_path_prompt' => "<question>輸入模型路徑（Enter 預設 {default}）：</question>\n",
            'name_required_non_interactive' => '<error>非互動模式下必須提供模型名參數，例如：php webman make:model User</error>',
            'invalid_name' => '<error>模型名無效。</error>',
            'invalid_plugin' => '<error>插件名稱無效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目錄下的目錄名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路徑無效：</error> <comment>{path}</comment> <error>。`--path/-P` 必須是相對路徑（相對於專案根目錄），不能是絕對路徑。</error>',
            'connection_not_found' => '<error>資料庫連線不存在：</error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>插件 </error> <comment>{plugin}</comment> <error> 未設定資料庫連線：</error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>資料庫連線與插件不符：目前插件=</error> <comment>{plugin}</comment> <error>，連線=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>插件 </error> <comment>{plugin}</comment> <error> 的預設資料庫連線無效：</error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> 資料庫不可用或無權限讀取表資訊，將產生空模型（可使用 -t/--table 指定）。',
            'table_list_failed' => '<comment>[Warning]</comment> 無法取得資料表清單，將產生空模型（可使用 -t/--table 指定）。',
            'db_connect_failed' => '<error>無法連接資料庫，請檢查 {configPath} 設定</error>',
            'db_permission_denied' => '<error>資料庫使用者{user}沒有讀取資料庫{database}表結構權限{hint}</error>',
            'db_permission_denied_hint' => '，請嘗試使用 -t 指定表名',
            'no_match' => '<comment>[Info]</comment> 未找到與模型名相符的表（依慣例推斷失敗）。',
            'prompt_help' => '<comment>[Info]</comment> 輸入序號選擇；輸入表名；Enter=更多；輸入 0=空模型；輸入 /關鍵字 過濾（輸入 / 清除過濾）。',
            'no_more' => '<comment>[Info]</comment> 沒有更多表可顯示。',
            'end_of_list' => '<comment>[Info]</comment> 已到清單末尾。可輸入表名、序號、0（空模型）或 /關鍵字。',
            'filter_cleared' => '<comment>[Info]</comment> 已清除過濾條件。',
            'filter_applied' => '<comment>[Info]</comment> 已套用過濾：`{keyword}`。',
            'filter_no_match' => '<comment>[Warning]</comment> 沒有表符合過濾 `{keyword}`。輸入 / 清除過濾或換個關鍵字。',
            'selection_out_of_range' => '<comment>[Warning]</comment> 序號超出範圍。可 Enter 查看更多或輸入有效序號。',
            'table_not_in_list' => '<comment>[Warning]</comment> 表 `{table}` 不在目前資料庫清單中，將繼續嘗試產生（註解可能為空）。',
            'table_not_found_schema' => "<comment>[Warning]</comment> 表 `{table}` 未找到，將產生無註解的模型。",
            'table_not_found_empty' => '<comment>[Warning]</comment> 未找到資料表，將產生空模型（可使用 -t/--table 指定，互動終端下也可選擇）。',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> 資料庫不可用，將產生空模型。',
            'showing_range' => '<comment>[Info]</comment> 目前已顯示 {start}-{end}（累計 {shown}）。',
        ];

        $ja = [
            'make_model' => "<info>モデル作成</info> <comment>{name}</comment>",
            'created' => '<info>作成済み：</info> <comment>{path}</comment>',
            'override_prompt' => "<question>ファイルが既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>無効なプラグイン名：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名のみで、/ または \\ を含めません。</error>',
            'invalid_path' => '<error>無効なパス：</error> <comment>{path}</comment> <error>。`--path/-P` はプロジェクトルートからの相対パスで、絶対パスは不可です。</error>',
            'connection_not_found' => '<error>データベース接続がありません：</error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>プラグイン </error> <comment>{plugin}</comment> <error> にデータベース接続が設定されていません：</error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>データベース接続とプラグインが一致しません：プラグイン=</error> <comment>{plugin}</comment> <error>、接続=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>プラグイン </error> <comment>{plugin}</comment> <error> のデフォルト接続が無効です：</error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> データベースにアクセスできないか権限がありません。空のモデルを生成します（-t/--table で指定可）。',
            'table_list_failed' => '<comment>[Warning]</comment> テーブル一覧を取得できません。空のモデルを生成します（-t/--table で指定可）。',
            'db_connect_failed' => '<error>データベースに接続できません。{configPath} を確認してください。</error>',
            'db_permission_denied' => '<error>データベースユーザー{user}は{database}のテーブル構造を読み取る権限がありません。{hint}</error>',
            'db_permission_denied_hint' => ' -tでテーブルを指定してみてください。',
            'no_match' => '<comment>[Info]</comment> 慣例に合うテーブルが見つかりませんでした。',
            'prompt_help' => '<comment>[Info]</comment> 数字で選択、テーブル名入力、Enterで続き、0で空モデル、/キーワードで絞り込み（/で解除）。',
            'no_more' => '<comment>[Info]</comment> これ以上テーブルはありません。',
            'end_of_list' => '<comment>[Info]</comment> 一覧の最後です。テーブル名・数字・0（空）・/キーワードを入力してください。',
            'filter_cleared' => '<comment>[Info]</comment> 絞り込みを解除しました。',
            'filter_applied' => '<comment>[Info]</comment> 絞り込み適用：`{keyword}`。',
            'filter_no_match' => '<comment>[Warning]</comment> `{keyword}` に一致するテーブルがありません。/ で解除するか別のキーワードを試してください。',
            'selection_out_of_range' => '<comment>[Warning]</comment> 選択が範囲外です。Enterで続きを表示するか、有効な数字を入力してください。',
            'table_not_in_list' => '<comment>[Warning]</comment> テーブル `{table}` は現在の一覧にありません。生成を試みます（スキーマ注釈は空の可能性あり）。',
            'table_not_found_schema' => "<comment>[Warning]</comment> テーブル `{table}` が見つかりません。スキーマ注釈なしでモデルを生成します。",
            'table_not_found_empty' => '<comment>[Warning]</comment> テーブルが見つかりません。空のモデルを生成します（-t/--table 指定、または対応端末で対話選択可）。',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> データベースに接続できません。空のモデルを生成します。',
            'showing_range' => '<comment>[Info]</comment> 表示中 {start}-{end}（表示数合計：{shown}）。',
        ];

        $ko = [
            'make_model' => "<info>모델 생성</info> <comment>{name}</comment>",
            'created' => '<info>생성됨:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>파일이 이미 존재합니다: {path}</question>\n<question>덮어쓸까요? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>잘못된 플러그인 이름: {plugin}. `--plugin/-p`는 plugin/ 디렉터리 이름이어야 하며 / 또는 \\를 포함할 수 없습니다.</error>',
            'invalid_path' => '<error>잘못된 경로: </error> <comment>{path}</comment> <error>. `--path/-P`는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 안 됩니다.</error>',
            'connection_not_found' => '<error>데이터베이스 연결을 찾을 수 없음: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>플러그인 {plugin}에 데이터베이스 연결이 설정되어 있지 않음: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>데이터베이스 연결과 플러그인이 일치하지 않음: 플러그인=</error> <comment>{plugin}</comment> <error>, 연결=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>플러그인 {plugin}의 기본 데이터베이스 연결이 잘못됨: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> 데이터베이스에 접근할 수 없거나 권한이 없습니다. 빈 모델을 생성합니다 (-t/--table로 지정 가능).',
            'table_list_failed' => '<comment>[Warning]</comment> 테이블 목록을 가져올 수 없습니다. 빈 모델을 생성합니다 (-t/--table로 지정 가능).',
            'db_connect_failed' => '<error>데이터베이스에 연결할 수 없습니다. {configPath} 설정을 확인하세요.</error>',
            'db_permission_denied' => '<error>데이터베이스 사용자 {user}에 {database} 테이블 구조 읽기 권한이 없습니다.{hint}</error>',
            'db_permission_denied_hint' => ' -t로 테이블을 지정해 보세요.',
            'no_match' => '<comment>[Info]</comment> 규칙에 맞는 테이블이 없습니다.',
            'prompt_help' => '<comment>[Info]</comment> 숫자로 선택, 테이블명 입력, Enter=더보기, 0=빈 모델, /키워드=필터 (/로 해제).',
            'no_more' => '<comment>[Info]</comment> 더 표시할 테이블이 없습니다.',
            'end_of_list' => '<comment>[Info]</comment> 목록 끝. 테이블명·숫자·0(빈 모델)·/키워드 입력.',
            'filter_cleared' => '<comment>[Info]</comment> 필터를 해제했습니다.',
            'filter_applied' => '<comment>[Info]</comment> 필터 적용: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> `{keyword}`에 맞는 테이블이 없습니다. /로 해제하거나 다른 키워드를 입력하세요.',
            'selection_out_of_range' => '<comment>[Warning]</comment> 선택이 범위를 벗어났습니다. Enter로 더 보기 또는 유효한 숫자를 입력하세요.',
            'table_not_in_list' => '<comment>[Warning]</comment> 테이블 `{table}`이 현재 목록에 없습니다. 그래도 생성 시도 (스키마 주석은 비어 있을 수 있음).',
            'table_not_found_schema' => "<comment>[Warning]</comment> 테이블 `{table}`을 찾을 수 없음. 스키마 주석 없이 모델 생성.",
            'table_not_found_empty' => '<comment>[Warning]</comment> 테이블을 찾을 수 없습니다. 빈 모델을 생성합니다 (-t/--table 지정 또는 지원 터미널에서 대화 선택).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> 데이터베이스에 연결할 수 없습니다. 빈 모델을 생성합니다.',
            'showing_range' => '<comment>[Info]</comment> {start}-{end} 표시 중 (총 {shown}개).',
        ];

        $fr = [
            'make_model' => "<info>Créer le modèle</info> <comment>{name}</comment>",
            'created' => '<info>Créé :</info> <comment>{path}</comment>',
            'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de répertoire sous plugin/ et ne doit pas contenir / ou \\.</error>',
            'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. `--path/-P` doit être un chemin relatif (à la racine du projet), pas un chemin absolu.</error>',
            'connection_not_found' => '<error>Connexion à la base de données introuvable : </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Le plugin </error> <comment>{plugin}</comment> <error> n\'a pas de connexion configurée : </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>La connexion ne correspond pas au plugin : plugin=</error> <comment>{plugin}</comment> <error>, connexion=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Connexion par défaut invalide pour le plugin </error> <comment>{plugin}</comment> <error> : </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Base de données inaccessible ou permission refusée. Génération d\'un modèle vide (utilisez -t/--table pour préciser).',
            'table_list_failed' => '<comment>[Warning]</comment> Impossible de récupérer la liste des tables. Génération d\'un modèle vide (utilisez -t/--table pour préciser).',
            'db_connect_failed' => '<error>Impossible de se connecter à la base de données. Vérifiez la configuration {configPath}.</error>',
            'db_permission_denied' => '<error>L\'utilisateur {user} n\'a pas la permission de lire le schéma de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Utilisez -t pour préciser une table.',
            'no_match' => '<comment>[Info]</comment> Aucune table ne correspond au nom du modèle par convention.',
            'prompt_help' => '<comment>[Info]</comment> Entrez un numéro pour choisir, un nom de table, Entrée pour plus, 0 pour un modèle vide, ou /mot-clé pour filtrer (/ pour effacer).',
            'no_more' => '<comment>[Info]</comment> Plus de tables à afficher.',
            'end_of_list' => '<comment>[Info]</comment> Fin de liste. Saisissez un nom de table, un numéro, 0 pour vide, ou /mot-clé.',
            'filter_cleared' => '<comment>[Info]</comment> Filtre effacé.',
            'filter_applied' => '<comment>[Info]</comment> Filtre appliqué : `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Aucune table ne correspond au filtre `{keyword}`. Utilisez / pour effacer ou un autre mot-clé.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Sélection hors limites. Entrée pour plus, ou un numéro valide.',
            'table_not_in_list' => '<comment>[Warning]</comment> La table `{table}` n\'est pas dans la liste actuelle. Génération tentée quand même (annotations de schéma peuvent être vides).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Table `{table}` introuvable, génération du modèle sans annotations de schéma.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Table introuvable. Génération d\'un modèle vide (-t/--table pour préciser, ou choix interactif en terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Base de données inaccessible. Génération d\'un modèle vide.',
            'showing_range' => '<comment>[Info]</comment> Affichage {start}-{end} (total affiché : {shown}).',
        ];

        $de = [
            'make_model' => "<info>Modell erstellen</info> <comment>{name}</comment>",
            'created' => '<info>Erstellt:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Verzeichnisname unter plugin/ sein und darf / oder \\ nicht enthalten.</error>',
            'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. `--path/-P` muss ein relativer Pfad (zur Projektwurzel) sein, kein absoluter.</error>',
            'connection_not_found' => '<error>Datenbankverbindung nicht gefunden: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> hat keine konfigurierte Datenbankverbindung: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Datenbankverbindung passt nicht zum Plugin: Plugin=</error> <comment>{plugin}</comment> <error>, Verbindung=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Ungültige Standard-Datenbankverbindung für Plugin {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Datenbank nicht erreichbar oder keine Berechtigung. Leeres Modell wird erzeugt (mit -t/--table angeben).',
            'table_list_failed' => '<comment>[Warning]</comment> Tabellenliste konnte nicht geladen werden. Leeres Modell wird erzeugt (mit -t/--table angeben).',
            'db_connect_failed' => '<error>Datenbankverbindung fehlgeschlagen. Prüfen Sie {configPath}.</error>',
            'db_permission_denied' => '<error>Datenbankbenutzer {user} hat keine Berechtigung, das Schema von {database} zu lesen.{hint}</error>',
            'db_permission_denied_hint' => ' Versuchen Sie -t zur Tabellenangabe.',
            'no_match' => '<comment>[Info]</comment> Keine Tabelle entspricht dem Modellnamen nach Konvention.',
            'prompt_help' => '<comment>[Info]</comment> Nummer eingeben zum Auswählen, Tabellenname, Enter für mehr, 0 für leeres Modell, /Schlüsselwort zum Filtern (/ zum Löschen).',
            'no_more' => '<comment>[Info]</comment> Keine weiteren Tabellen.',
            'end_of_list' => '<comment>[Info]</comment> Listenende. Tabellenname, Nummer, 0 für leer oder /Schlüsselwort eingeben.',
            'filter_cleared' => '<comment>[Info]</comment> Filter gelöscht.',
            'filter_applied' => '<comment>[Info]</comment> Filter angewendet: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Keine Tabellen passen zum Filter `{keyword}`. / zum Löschen oder anderes Schlüsselwort.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Auswahl außerhalb des Bereichs. Enter für mehr oder gültige Nummer eingeben.',
            'table_not_in_list' => '<comment>[Warning]</comment> Tabelle `{table}` ist nicht in der aktuellen Liste. Wird trotzdem erzeugt (Schema-Annotationen können leer sein).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Tabelle `{table}` nicht gefunden, Modell ohne Schema-Annotationen wird erzeugt.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Tabelle nicht gefunden. Leeres Modell wird erzeugt (-t/--table angeben oder interaktiv im Terminal wählen).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Datenbank nicht erreichbar. Leeres Modell wird erzeugt.',
            'showing_range' => '<comment>[Info]</comment> Anzeige {start}-{end} (insgesamt angezeigt: {shown}).',
        ];

        $es = [
            'make_model' => "<info>Crear modelo</info> <comment>{name}</comment>",
            'created' => '<info>Creado:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Nombre de plugin inválido: {plugin}. `--plugin/-p` debe ser un nombre de directorio bajo plugin/ y no puede contener / o \\.</error>',
            'invalid_path' => '<error>Ruta inválida: </error> <comment>{path}</comment> <error>. `--path/-P` debe ser una ruta relativa (al directorio raíz del proyecto), no absoluta.</error>',
            'connection_not_found' => '<error>Conexión a base de datos no encontrada: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>El plugin </error> <comment>{plugin}</comment> <error> no tiene conexión configurada: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>La conexión no coincide con el plugin: plugin=</error> <comment>{plugin}</comment> <error>, conexión=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Conexión por defecto inválida para el plugin {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Base de datos no accesible o sin permiso. Se generará un modelo vacío (use -t/--table para especificar).',
            'table_list_failed' => '<comment>[Warning]</comment> No se pudo obtener la lista de tablas. Se generará un modelo vacío (use -t/--table para especificar).',
            'db_connect_failed' => '<error>No se puede conectar a la base de datos. Compruebe {configPath}.</error>',
            'db_permission_denied' => '<error>El usuario {user} no tiene permiso para leer el esquema de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Use -t para especificar una tabla.',
            'no_match' => '<comment>[Info]</comment> Ninguna tabla coincide con el nombre del modelo por convención.',
            'prompt_help' => '<comment>[Info]</comment> Introduzca un número para elegir, nombre de tabla, Enter para más, 0 para modelo vacío, o /palabra clave para filtrar (/ para limpiar).',
            'no_more' => '<comment>[Info]</comment> No hay más tablas que mostrar.',
            'end_of_list' => '<comment>[Info]</comment> Fin de lista. Escriba nombre de tabla, número, 0 para vacío o /palabra clave.',
            'filter_cleared' => '<comment>[Info]</comment> Filtro limpiado.',
            'filter_applied' => '<comment>[Info]</comment> Filtro aplicado: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Ninguna tabla coincide con el filtro `{keyword}`. Use / para limpiar o otra palabra clave.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Selección fuera de rango. Enter para más o elija un número válido.',
            'table_not_in_list' => '<comment>[Warning]</comment> La tabla `{table}` no está en la lista actual. Se intentará generar de todos modos (las anotaciones de esquema pueden estar vacías).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Tabla `{table}` no encontrada, generando modelo sin anotaciones de esquema.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Tabla no encontrada. Se generará un modelo vacío (use -t/--table o elija de forma interactiva en terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> No se puede acceder a la base de datos. Se generará un modelo vacío.',
            'showing_range' => '<comment>[Info]</comment> Mostrando {start}-{end} (total mostrado: {shown}).',
        ];

        $ptBR = [
            'make_model' => "<info>Criar modelo</info> <comment>{name}</comment>",
            'created' => '<info>Criado:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de diretório sob plugin/ e não pode conter / ou \\.</error>',
            'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. `--path/-P` deve ser um caminho relativo (à raiz do projeto), não absoluto.</error>',
            'connection_not_found' => '<error>Conexão de banco de dados não encontrada: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>O plugin </error> <comment>{plugin}</comment> <error> não tem conexão configurada: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>A conexão não corresponde ao plugin: plugin=</error> <comment>{plugin}</comment> <error>, conexão=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Conexão padrão inválida para o plugin {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Banco de dados inacessível ou permissão negada. Gerando modelo vazio (use -t/--table para especificar).',
            'table_list_failed' => '<comment>[Warning]</comment> Não foi possível obter a lista de tabelas. Gerando modelo vazio (use -t/--table para especificar).',
            'db_connect_failed' => '<error>Não foi possível conectar ao banco de dados. Verifique {configPath}.</error>',
            'db_permission_denied' => '<error>O usuário {user} não tem permissão para ler o esquema de {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Use -t para especificar uma tabela.',
            'no_match' => '<comment>[Info]</comment> Nenhuma tabela corresponde ao nome do modelo por convenção.',
            'prompt_help' => '<comment>[Info]</comment> Digite um número para escolher, nome da tabela, Enter para mais, 0 para modelo vazio, ou /palavra para filtrar (use / para limpar).',
            'no_more' => '<comment>[Info]</comment> Não há mais tabelas para mostrar.',
            'end_of_list' => '<comment>[Info]</comment> Fim da lista. Digite nome da tabela, número, 0 para vazio ou /palavra.',
            'filter_cleared' => '<comment>[Info]</comment> Filtro limpo.',
            'filter_applied' => '<comment>[Info]</comment> Filtro aplicado: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Nenhuma tabela corresponde ao filtro `{keyword}`. Use / para limpar ou outra palavra.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Seleção fora do intervalo. Enter para mais ou escolha um número válido.',
            'table_not_in_list' => '<comment>[Warning]</comment> A tabela `{table}` não está na lista atual. Será tentada a geração mesmo assim (anotações de esquema podem estar vazias).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Tabela `{table}` não encontrada, gerando modelo sem anotações de esquema.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Tabela não encontrada. Gerando modelo vazio (use -t/--table ou escolha interativa no terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Banco de dados inacessível. Gerando modelo vazio.',
            'showing_range' => '<comment>[Info]</comment> Mostrando {start}-{end} (total mostrado: {shown}).',
        ];

        $ru = [
            'make_model' => "<info>Создать модель</info> <comment>{name}</comment>",
            'created' => '<info>Создано:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/ и не содержать / или \\.</error>',
            'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. `--path/-P` должен быть относительным путём (к корню проекта), не абсолютным.</error>',
            'connection_not_found' => '<error>Подключение к БД не найдено: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>У плагина </error> <comment>{plugin}</comment> <error> не настроено подключение: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Подключение не соответствует плагину: плагин=</error> <comment>{plugin}</comment> <error>, подключение=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Недопустимое подключение по умолчанию для плагина {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> БД недоступна или нет прав. Будет создана пустая модель (используйте -t/--table для указания).',
            'table_list_failed' => '<comment>[Warning]</comment> Не удалось получить список таблиц. Будет создана пустая модель (используйте -t/--table для указания).',
            'db_connect_failed' => '<error>Не удалось подключиться к базе данных. Проверьте {configPath}.</error>',
            'db_permission_denied' => '<error>Пользователь {user} не имеет права читать схему {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Используйте -t для указания таблицы.',
            'no_match' => '<comment>[Info]</comment> Нет таблицы, соответствующей имени модели по соглашению.',
            'prompt_help' => '<comment>[Info]</comment> Введите номер для выбора, имя таблицы, Enter — ещё, 0 — пустая модель, /ключ — фильтр (/ — сброс).',
            'no_more' => '<comment>[Info]</comment> Больше таблиц нет.',
            'end_of_list' => '<comment>[Info]</comment> Конец списка. Введите имя таблицы, номер, 0 для пустой или /ключ.',
            'filter_cleared' => '<comment>[Info]</comment> Фильтр сброшен.',
            'filter_applied' => '<comment>[Info]</comment> Применён фильтр: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Нет таблиц по фильтру `{keyword}`. Введите / для сброса или другой ключ.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Выбор вне диапазона. Enter — ещё или введите допустимый номер.',
            'table_not_in_list' => '<comment>[Warning]</comment> Таблица `{table}` не в текущем списке. Всё равно будет попытка создания (аннотации схемы могут быть пустыми).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Таблица `{table}` не найдена, создаётся модель без аннотаций схемы.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Таблица не найдена. Создаётся пустая модель (-t/--table для указания или интерактивный выбор в терминале).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> БД недоступна. Создаётся пустая модель.',
            'showing_range' => '<comment>[Info]</comment> Показано {start}-{end} (всего: {shown}).',
        ];

        $vi = [
            'make_model' => "<info>Tạo model</info> <comment>{name}</comment>",
            'created' => '<info>Đã tạo:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/ và không được chứa / hoặc \\.</error>',
            'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. `--path/-P` phải là đường dẫn tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>',
            'connection_not_found' => '<error>Không tìm thấy kết nối cơ sở dữ liệu: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> chưa cấu hình kết nối: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Kết nối không khớp với plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Kết nối mặc định không hợp lệ cho plugin {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Không truy cập được cơ sở dữ liệu hoặc bị từ chối quyền. Sẽ tạo model rỗng (dùng -t/--table để chỉ định).',
            'table_list_failed' => '<comment>[Warning]</comment> Không lấy được danh sách bảng. Sẽ tạo model rỗng (dùng -t/--table để chỉ định).',
            'db_connect_failed' => '<error>Không thể kết nối cơ sở dữ liệu. Kiểm tra cấu hình {configPath}.</error>',
            'db_permission_denied' => '<error>Người dùng {user} không có quyền đọc schema của {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Dùng -t để chỉ định bảng.',
            'no_match' => '<comment>[Info]</comment> Không có bảng nào khớp với tên model theo quy ước.',
            'prompt_help' => '<comment>[Info]</comment> Nhập số để chọn, tên bảng, Enter để xem thêm, 0 cho model rỗng, hoặc /từ khóa để lọc (dùng / để xóa).',
            'no_more' => '<comment>[Info]</comment> Không còn bảng nào để hiển thị.',
            'end_of_list' => '<comment>[Info]</comment> Hết danh sách. Gõ tên bảng, số, 0 cho rỗng hoặc /từ khóa.',
            'filter_cleared' => '<comment>[Info]</comment> Đã xóa bộ lọc.',
            'filter_applied' => '<comment>[Info]</comment> Đã áp dụng bộ lọc: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Không có bảng nào khớp bộ lọc `{keyword}`. Dùng / để xóa hoặc thử từ khóa khác.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Lựa chọn ngoài phạm vi. Enter để xem thêm hoặc chọn số hợp lệ.',
            'table_not_in_list' => '<comment>[Warning]</comment> Bảng `{table}` không có trong danh sách hiện tại. Sẽ vẫn thử tạo (chú thích schema có thể trống).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Không tìm thấy bảng `{table}`, đang tạo model không có chú thích schema.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Không tìm thấy bảng. Đang tạo model rỗng (dùng -t/--table hoặc chọn tương tác trong terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Không truy cập được cơ sở dữ liệu. Đang tạo model rỗng.',
            'showing_range' => '<comment>[Info]</comment> Đang hiển thị {start}-{end} (tổng: {shown}).',
        ];

        $tr = [
            'make_model' => "<info>Model oluştur</info> <comment>{name}</comment>",
            'created' => '<info>Oluşturuldu:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>Dosya zaten mevcut: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altında bir dizin adı olmalı ve / veya \\ içermemeli.</error>',
            'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. `--path/-P` proje köküne göre göreli yol olmalı, mutlak yol olmamalı.</error>',
            'connection_not_found' => '<error>Veritabanı bağlantısı bulunamadı: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Eklenti </error> <comment>{plugin}</comment> <error> için veritabanı bağlantısı yapılandırılmamış: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Veritabanı bağlantısı eklentiyle eşleşmiyor: eklenti=</error> <comment>{plugin}</comment> <error>, bağlantı=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Eklenti </error> <comment>{plugin}</comment> <error> için varsayılan bağlantı geçersiz: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Veritabanına erişilemiyor veya izin yok. Boş model oluşturulacak (-t/--table ile belirtin).',
            'table_list_failed' => '<comment>[Warning]</comment> Tablo listesi alınamadı. Boş model oluşturulacak (-t/--table ile belirtin).',
            'db_connect_failed' => '<error>Veritabanına bağlanılamıyor. {configPath} yapılandırmasını kontrol edin.</error>',
            'db_permission_denied' => '<error>{user} kullanıcısının {database} şemasını okuma izni yok.{hint}</error>',
            'db_permission_denied_hint' => ' Tablo belirtmek için -t kullanmayı deneyin.',
            'no_match' => '<comment>[Info]</comment> Kurala göre model adıyla eşleşen tablo yok.',
            'prompt_help' => '<comment>[Info]</comment> Seçmek için numara girin, tablo adı yazın, daha fazlası için Enter, boş model için 0, veya /anahtar ile filtreleyin (/ ile temizleyin).',
            'no_more' => '<comment>[Info]</comment> Gösterilecek başka tablo yok.',
            'end_of_list' => '<comment>[Info]</comment> Listenin sonu. Tablo adı, numara, 0 (boş) veya /anahtar yazın.',
            'filter_cleared' => '<comment>[Info]</comment> Filtre temizlendi.',
            'filter_applied' => '<comment>[Info]</comment> Filtre uygulandı: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> `{keyword}` filtresine uyan tablo yok. Temizlemek için / veya başka anahtar deneyin.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Seçim aralığın dışında. Daha fazlası için Enter veya geçerli numara girin.',
            'table_not_in_list' => '<comment>[Warning]</comment> Tablo `{table}` mevcut listede yok. Yine de oluşturulacak (şema açıklamaları boş olabilir).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Tablo `{table}` bulunamadı, şema açıklamaları olmadan model oluşturuluyor.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Tablo bulunamadı. Boş model oluşturuluyor (-t/--table belirtin veya desteklenen terminalde etkileşimli seçin).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Veritabanına erişilemiyor. Boş model oluşturuluyor.',
            'showing_range' => '<comment>[Info]</comment> {start}-{end} gösteriliyor (toplam: {shown}).',
        ];

        $id = [
            'make_model' => "<info>Buat model</info> <comment>{name}</comment>",
            'created' => '<info>Dibuat:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama direktori di bawah plugin/ dan tidak boleh berisi / atau \\.</error>',
            'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. `--path/-P` harus path relatif (ke root proyek), bukan absolut.</error>',
            'connection_not_found' => '<error>Koneksi database tidak ditemukan: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>Plugin </error> <comment>{plugin}</comment> <error> tidak memiliki koneksi yang dikonfigurasi: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>Koneksi tidak cocok dengan plugin: plugin=</error> <comment>{plugin}</comment> <error>, connection=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>Koneksi default tidak valid untuk plugin {plugin}: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> Database tidak dapat diakses atau izin ditolak. Membuat model kosong (gunakan -t/--table untuk menentukan).',
            'table_list_failed' => '<comment>[Warning]</comment> Tidak dapat mengambil daftar tabel. Membuat model kosong (gunakan -t/--table untuk menentukan).',
            'db_connect_failed' => '<error>Tidak dapat terhubung ke database. Periksa konfigurasi {configPath}.</error>',
            'db_permission_denied' => '<error>Pengguna {user} tidak memiliki izin membaca skema {database}.{hint}</error>',
            'db_permission_denied_hint' => ' Coba gunakan -t untuk menentukan tabel.',
            'no_match' => '<comment>[Info]</comment> Tidak ada tabel yang cocok dengan nama model menurut konvensi.',
            'prompt_help' => '<comment>[Info]</comment> Masukkan angka untuk memilih, nama tabel, Enter untuk lebih banyak, 0 untuk model kosong, atau /kata kunci untuk memfilter (gunakan / untuk hapus).',
            'no_more' => '<comment>[Info]</comment> Tidak ada lagi tabel untuk ditampilkan.',
            'end_of_list' => '<comment>[Info]</comment> Akhir daftar. Ketik nama tabel, angka, 0 untuk kosong, atau /kata kunci.',
            'filter_cleared' => '<comment>[Info]</comment> Filter dihapus.',
            'filter_applied' => '<comment>[Info]</comment> Filter diterapkan: `{keyword}`.',
            'filter_no_match' => '<comment>[Warning]</comment> Tidak ada tabel yang cocok dengan filter `{keyword}`. Gunakan / untuk hapus atau coba kata kunci lain.',
            'selection_out_of_range' => '<comment>[Warning]</comment> Pilihan di luar jangkauan. Enter untuk lebih banyak atau pilih angka yang valid.',
            'table_not_in_list' => '<comment>[Warning]</comment> Tabel `{table}` tidak ada di daftar saat ini. Akan tetap dicoba dibuat (anotasi skema mungkin kosong).',
            'table_not_found_schema' => "<comment>[Warning]</comment> Tabel `{table}` tidak ditemukan, membuat model tanpa anotasi skema.",
            'table_not_found_empty' => '<comment>[Warning]</comment> Tabel tidak ditemukan. Membuat model kosong (gunakan -t/--table atau pilih interaktif di terminal).',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> Database tidak dapat diakses. Membuat model kosong.',
            'showing_range' => '<comment>[Info]</comment> Menampilkan {start}-{end} (total ditampilkan: {shown}).',
        ];

        $th = [
            'make_model' => "<info>สร้างโมเดล</info> <comment>{name}</comment>",
            'created' => '<info>สร้างแล้ว:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>ไฟล์มีอยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n",
            'enter_model_name_prompt' => "<question>Enter model name (Enter default: {default}):</question>\n",
            'enter_model_path_prompt' => "<question>Enter model path (Enter default: {default}):</question>\n",
            'name_required_non_interactive' => '<error>Model name is required in non-interactive mode. e.g. php webman make:model User</error>',
            'invalid_name' => '<error>Invalid model name.</error>',
            'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ และต้องไม่มี / หรือ \\.</error>',
            'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. `--path/-P` ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่เส้นทางสัมบูรณ์</error>',
            'connection_not_found' => '<error>ไม่พบการเชื่อมต่อฐานข้อมูล: </error> <comment>{connection}</comment>',
            'connection_not_found_plugin' => '<error>ปลั๊กอิน </error> <comment>{plugin}</comment> <error> ไม่มีการตั้งค่าการเชื่อมต่อ: </error> <comment>{connection}</comment>',
            'connection_plugin_mismatch' => '<error>การเชื่อมต่อไม่ตรงกับปลั๊กอิน: ปลั๊กอิน=</error> <comment>{plugin}</comment> <error>, การเชื่อมต่อ=</error> <comment>{connection}</comment>',
            'plugin_default_connection_invalid' => '<error>การเชื่อมต่อเริ่มต้นของปลั๊กอิน </error> <comment>{plugin}</comment> <error> ไม่ถูกต้อง: </error> <comment>{connection}</comment>',
            'db_unavailable' => '<comment>[Warning]</comment> เข้าถึงฐานข้อมูลไม่ได้หรือไม่มีสิทธิ์ จะสร้างโมเดลว่าง (ใช้ -t/--table เพื่อระบุ)',
            'table_list_failed' => '<comment>[Warning]</comment> ดึงรายการตารางไม่ได้ จะสร้างโมเดลว่าง (ใช้ -t/--table เพื่อระบุ)',
            'db_connect_failed' => '<error>ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า {configPath}</error>',
            'db_permission_denied' => '<error>ผู้ใช้ {user} ไม่มีสิทธิ์อ่านโครงสร้างตารางของ {database}{hint}</error>',
            'db_permission_denied_hint' => ' ลองใช้ -t เพื่อระบุตาราง',
            'no_match' => '<comment>[Info]</comment> ไม่มีตารางที่ตรงกับชื่อโมเดลตามธรรมเนียม',
            'prompt_help' => '<comment>[Info]</comment> ใส่ตัวเลขเพื่อเลือก ชื่อตาราง Enter=เพิ่ม 0=โมเดลว่าง หรือ /คำค้นเพื่อกรอง (ใช้ / เพื่อล้าง)',
            'no_more' => '<comment>[Info]</comment> ไม่มีตารางเพิ่มให้แสดง',
            'end_of_list' => '<comment>[Info]</comment> จบรายการ ใส่ชื่อตาราง ตัวเลข 0 (ว่าง) หรือ /คำค้น',
            'filter_cleared' => '<comment>[Info]</comment> ล้างตัวกรองแล้ว',
            'filter_applied' => '<comment>[Info]</comment> ใช้ตัวกรอง: `{keyword}`',
            'filter_no_match' => '<comment>[Warning]</comment> ไม่มีตารางตรงกับตัวกรอง `{keyword}` ใช้ / เพื่อล้างหรือลองคำอื่น',
            'selection_out_of_range' => '<comment>[Warning]</comment> การเลือกนอกช่วง กด Enter เพื่อดูเพิ่มหรือเลือกตัวเลขที่ถูกต้อง',
            'table_not_in_list' => '<comment>[Warning]</comment> ตาราง `{table}` ไม่อยู่ในรายการปัจจุบัน จะลองสร้างต่อไป (คำอธิบาย schema อาจว่าง)',
            'table_not_found_schema' => "<comment>[Warning]</comment> ไม่พบตาราง `{table}` กำลังสร้างโมเดลโดยไม่มีคำอธิบาย schema",
            'table_not_found_empty' => '<comment>[Warning]</comment> ไม่พบตาราง กำลังสร้างโมเดลว่าง (ใช้ -t/--table หรือเลือกแบบโต้ตอบในเทอร์มินัล)',
            'table_not_found_empty_db_failed' => '<comment>[Warning]</comment> เข้าถึงฐานข้อมูลไม่ได้ กำลังสร้างโมเดลว่าง',
            'showing_range' => '<comment>[Info]</comment> แสดง {start}-{end} (รวมที่แสดง: {shown})',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en, 'ja' => $ja, 'ko' => $ko, 'fr' => $fr,
            'de' => $de, 'es' => $es, 'pt_BR' => $ptBR, 'ru' => $ru, 'vi' => $vi, 'tr' => $tr,
            'id' => $id, 'th' => $th,
        ];
    }

    public static function getMakeModelHelpText(): array
    {
        $zh = <<<'EOF'
生成模型文件，并在表存在时自动读取表结构生成 @property 注释。

推荐用法：
  php webman make:model User
  php webman make:model User -p admin
  php webman make:model User -P plugin/admin/app/model
  php webman make:model User -t wa_users -o laravel
  php webman make:model User -t wa_users -o thinkorm
  php webman make:model User -f

交互式选表（仅支持交互终端且推断失败时出现）：
  - 回车：显示更多表
  - 输入数字：选择已展示表
  - 输入表名：直接使用
  - 输入 0：生成空模型
  - 输入 /关键字：过滤（输入 / 清除过滤）
EOF;
        $zhTW = <<<'EOF'
生成模型檔案，並在表存在時自動讀取表結構生成 @property 註解。

推薦用法：
  php webman make:model User
  php webman make:model User -p admin
  php webman make:model User -P plugin/admin/app/model
  php webman make:model User -t wa_users -o laravel
  php webman make:model User -t wa_users -o thinkorm
  php webman make:model User -f

互動式選表（僅支援互動終端且推斷失敗時出現）：
  - 回車：顯示更多表
  - 輸入數字：選擇已展示表
  - 輸入表名：直接使用
  - 輸入 0：生成空模型
  - 輸入 /關鍵字：篩選（輸入 / 清除篩選）
EOF;
        $en = <<<'EOF'
Generate a model file and (when the table exists) generate @property annotations from the table schema.

Recommended:
  php webman make:model User
  php webman make:model User -p admin
  php webman make:model User -P plugin/admin/app/model
  php webman make:model User -t wa_users -o laravel
  php webman make:model User -t wa_users -o thinkorm
  php webman make:model User -f

Interactive table picker (only in interactive terminals when guessing fails):
  - Enter: show more tables
  - Number: select from shown list
  - Table name: use directly
  - 0: generate an empty model
  - /keyword: filter (use / to clear)
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "モデルファイルを生成し、テーブルが存在する場合はスキーマから @property を生成。\n\n推奨：\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\n対話式テーブル選択（インタラクティブ端末でテーブル推定に失敗した場合に表示）：\n  - Enter: さらにテーブルを表示\n  - 数字: 一覧から選択\n  - テーブル名: そのまま使用\n  - 0: 空モデルを生成\n  - /キーワード: 絞り込み（/ で解除）",
            'ko' => "모델 파일 생성. 테이블이 있으면 스키마에서 @property 주석 생성.\n\n권장:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\n대화형 테이블 선택(대화형 터미널에서 추측 실패 시에만 표시):\n  - Enter: 테이블 더 보기\n  - 숫자: 목록에서 선택\n  - 테이블명: 직접 사용\n  - 0: 빈 모델 생성\n  - /키워드: 필터 (/ 로 해제)",
            'fr' => "Générer un fichier modèle et (si la table existe) des annotations @property depuis le schéma.\n\nRecommandé :\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nSélection de table interactive (en terminal interactif, si la détection échoue) :\n  - Entrée : afficher plus de tables\n  - Numéro : choisir dans la liste\n  - Nom de table : utiliser tel quel\n  - 0 : modèle vide\n  - /mot-clé : filtrer (/ pour effacer)",
            'de' => "Modelldatei erzeugen und (bei existierender Tabelle) @property aus dem Schema.\n\nEmpfohlen:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nInteraktive Tabellenauswahl (nur in interaktiven Terminals bei Fehlschlag):\n  - Enter: mehr Tabellen anzeigen\n  - Zahl: aus Liste wählen\n  - Tabellenname: direkt verwenden\n  - 0: leeres Modell\n  - /keyword: filtern (/ zum Zurücksetzen)",
            'es' => "Generar archivo de modelo y (si la tabla existe) anotaciones @property desde el esquema.\n\nRecomendado:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nSelector de tabla interactivo (solo en terminal interactivo si falla la detección):\n  - Enter: mostrar más tablas\n  - Número: elegir de la lista\n  - Nombre de tabla: usar directamente\n  - 0: modelo vacío\n  - /keyword: filtrar (/ para limpiar)",
            'pt_BR' => "Gerar arquivo de modelo e (quando a tabela existe) anotações @property do esquema.\n\nRecomendado:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nSeleção interativa de tabela (apenas em terminal interativo quando falha):\n  - Enter: mostrar mais tabelas\n  - Número: escolher da lista\n  - Nome da tabela: usar diretamente\n  - 0: modelo vazio\n  - /keyword: filtrar (use / para limpar)",
            'ru' => "Создать файл модели и (при существующей таблице) аннотации @property из схемы.\n\nРекомендуется:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nИнтерактивный выбор таблицы (только в интерактивном терминале при сбое):\n  - Enter: показать ещё таблицы\n  - Номер: выбрать из списка\n  - Имя таблицы: использовать как есть\n  - 0: пустая модель\n  - /ключевое_слово: фильтр (/ для сброса)",
            'vi' => "Tạo file model và (khi bảng tồn tại) chú thích @property từ schema.\n\nKhuyến nghị:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nChọn bảng tương tác (chỉ khi đoán thất bại trong terminal tương tác):\n  - Enter: xem thêm bảng\n  - Số: chọn từ danh sách\n  - Tên bảng: dùng trực tiếp\n  - 0: model rỗng\n  - /từ khóa: lọc (dùng / để xóa bộ lọc)",
            'tr' => "Model dosyası oluştur ve (tablo varsa) şemadan @property ekle.\n\nÖnerilen:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nİnteraktif tablo seçici (yalnızca interaktif uçbirimde ve tahmin başarısız olduğunda):\n  - Enter: daha fazla tablo göster\n  - Numara: listeden seç\n  - Tablo adı: doğrudan kullan\n  - 0: boş model\n  - /anahtar: filtre (/ ile temizle)",
            'id' => "Buat file model dan (jika tabel ada) anotasi @property dari skema.\n\nDirekomendasikan:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nPemilih tabel interaktif (hanya di terminal interaktif saat tebakan gagal):\n  - Enter: tampilkan lebih banyak tabel\n  - Angka: pilih dari daftar\n  - Nama tabel: gunakan langsung\n  - 0: model kosong\n  - /kata kunci: filter (gunakan / untuk hapus)",
            'th' => "สร้างไฟล์โมเดล และ (เมื่อมีตาราง) สร้าง @property จาก schema\n\nแนะนำ:\n  php webman make:model User\n  php webman make:model User -p admin\n  php webman make:model User -P plugin/admin/app/model\n  php webman make:model User -t wa_users -o laravel\n  php webman make:model User -t wa_users -o thinkorm\n  php webman make:model User -f\n\nตัวเลือกตารางแบบโต้ตอบ (เฉพาะในเทอร์มินัลแบบโต้ตอบเมื่อการเดาล้มเหลว):\n  - Enter: แสดงตารางเพิ่ม\n  - ตัวเลข: เลือกจากรายการ\n  - ชื่อตาราง: ใช้โดยตรง\n  - 0: โมเดลว่าง\n  - /คำค้น: กรอง (ใช้ / เพื่อล้าง)",
        ];
    }

    public static function getMakeControllerMessages(): array
    {
        $zh = [
            'make_controller' => '<info>创建控制器</info> <comment>{name}</comment>',
            'created' => '<info>已创建：</info> <comment>{path}</comment>',
            'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
            'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
        ];

        $en = [
            'make_controller' => '<info>Make controller</info> <comment>{name}</comment>',
            'created' => '<info>Created:</info> <comment>{path}</comment>',
            'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
            'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
            'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
        ];

        return [
            'zh_CN' => $zh, 
            'zh_TW' => [
                'make_controller' => '<info>建立控制器</info> <comment>{name}</comment>',
                'created' => '<info>已建立：</info> <comment>{path}</comment>',
                'override_prompt' => "<question>檔案已存在：{path}</question>\n<question>是否覆蓋？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>插件名稱無效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目錄下的目錄名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路徑無效：</error> <comment>{path}</comment> <error>。`--path/-P` 必須是相對路徑（相對於專案根目錄），不能是絕對路徑。</error>',
            ],
            'en' => $en,
            'ja' => [
                'make_controller' => '<info>コントローラを作成</info> <comment>{name}</comment>',
                'created' => '<info>作成しました：</info> <comment>{path}</comment>',
                'override_prompt' => "<question>ファイルが既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>プラグイン名が無効です：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名で、/ または \\ を含めません。</error>',
                'invalid_path' => '<error>パスが無効です：</error> <comment>{path}</comment> <error>。`--path/-P` はプロジェクトルートからの相対パスで、絶対パスは不可です。</error>',
            ],
            'ko' => ['make_controller' => '<info>컨트롤러 만들기</info> <comment>{name}</comment>', 'created' => '<info>생성됨:</info> <comment>{path}</comment>', 'override_prompt' => "<question>파일이 이미 있습니다: {path}</question>\n<question>덮어쓸까요? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>잘못된 플러그인 이름: {plugin}. `--plugin/-p`는 plugin/ 아래 디렉터리 이름이며 / 또는 \\를 포함할 수 없습니다.</error>', 'invalid_path' => '<error>잘못된 경로: </error> <comment>{path}</comment> <error>. `--path/-P`는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 안 됩니다.</error>'],
            'fr' => ['make_controller' => '<info>Créer un contrôleur</info> <comment>{name}</comment>', 'created' => '<info>Créé :</info> <comment>{path}</comment>', 'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n", 'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de dossier sous plugin/, sans / ni \\.</error>', 'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. `--path/-P` doit être un chemin relatif (à la racine du projet), pas absolu.</error>'],
            'de' => ['make_controller' => '<info>Controller erstellen</info> <comment>{name}</comment>', 'created' => '<info>Erstellt:</info> <comment>{path}</comment>', 'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Eingabe Standard: Y)</question>\n", 'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Ordnername unter plugin/ sein, ohne / oder \\.</error>', 'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. `--path/-P` muss ein relativer Pfad (zur Projektwurzel) sein, kein absoluter.</error>'],
            'es' => ['make_controller' => '<info>Crear controlador</info> <comment>{name}</comment>', 'created' => '<info>Creado:</info> <comment>{path}</comment>', 'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nombre de plugin no válido: {plugin}. `--plugin/-p` debe ser un nombre de carpeta bajo plugin/, sin / ni \\.</error>', 'invalid_path' => '<error>Ruta no válida: </error> <comment>{path}</comment> <error>. `--path/-P` debe ser una ruta relativa (a la raíz del proyecto), no absoluta.</error>'],
            'pt_BR' => ['make_controller' => '<info>Criar controlador</info> <comment>{name}</comment>', 'created' => '<info>Criado:</info> <comment>{path}</comment>', 'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de pasta em plugin/, sem / ou \\.</error>', 'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. `--path/-P` deve ser um caminho relativo (à raiz do projeto), não absoluto.</error>'],
            'ru' => ['make_controller' => '<info>Создать контроллер</info> <comment>{name}</comment>', 'created' => '<info>Создано:</info> <comment>{path}</comment>', 'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/, без / или \\.</error>', 'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. `--path/-P` должен быть относительным путём (к корню проекта), не абсолютным.</error>'],
            'vi' => ['make_controller' => '<info>Tạo controller</info> <comment>{name}</comment>', 'created' => '<info>Đã tạo:</info> <comment>{path}</comment>', 'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/, không chứa / hoặc \\.</error>', 'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. `--path/-P` phải là đường dẫn tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>'],
            'tr' => ['make_controller' => '<info>Denetleyici oluştur</info> <comment>{name}</comment>', 'created' => '<info>Oluşturuldu:</info> <comment>{path}</comment>', 'override_prompt' => "<question>Dosya zaten mevcut: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altında bir klasör adı olmalı, / veya \\ içermemeli.</error>', 'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. `--path/-P` proje köküne göre göreli yol olmalı, mutlak yol olmamalı.</error>'],
            'id' => ['make_controller' => '<info>Buat controller</info> <comment>{name}</comment>', 'created' => '<info>Dibuat:</info> <comment>{path}</comment>', 'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama folder di bawah plugin/, tidak boleh mengandung / atau \\.</error>', 'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. `--path/-P` harus path relatif (ke akar proyek), bukan absolut.</error>'],
            'th' => ['make_controller' => '<info>สร้างคอนโทรลเลอร์</info> <comment>{name}</comment>', 'created' => '<info>สร้างแล้ว:</info> <comment>{path}</comment>', 'override_prompt' => "<question>มีไฟล์อยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ ห้ามมี / หรือ \\</error>', 'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. `--path/-P` ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่แบบสัมบูรณ์</error>'],
        ];
    }

    public static function getMakeControllerHelpText(): array
    {
        $en = "Generate a controller file.\n\nRecommended:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nNotes:\n  - By default, it generates under app/controller (case depends on existing directory).\n  - With -p/--plugin, it generates under plugin/<plugin>/app/controller by default.\n  - With -P/--path, it generates under the specified relative directory (to project root).\n  - If the file already exists, it will ask before overriding; use -f/--force to override directly.";
        return [
            'zh_CN' => "生成控制器文件。\n\n推荐用法：\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\n说明：\n  - 默认生成到 app/controller（大小写以现有目录为准）。\n  - 使用 -p/--plugin 时默认生成到 plugin/<plugin>/app/controller。\n  - 使用 -P/--path 时生成到指定相对目录（相对于项目根目录）。\n  - 文件已存在时默认会提示是否覆盖；使用 -f/--force 可直接覆盖。",
            'zh_TW' => "建立控制器檔案。\n\n推薦用法：\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\n說明：\n  - 預設生成到 app/controller（大小寫依現有目錄）。\n  - 使用 -p/--plugin 時預設生成到 plugin/<plugin>/app/controller。\n  - 使用 -P/--path 時生成到指定相對目錄（相對於專案根目錄）。\n  - 檔案已存在時會詢問是否覆蓋；使用 -f/--force 可直接覆蓋。",
            'en' => $en,
            'ja' => "コントローラファイルを生成。\n\n推奨：\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\n説明：\n  - デフォルトは app/controller に生成（大文字小文字は既存ディレクトリに合わせる）。\n  - -p/--plugin の場合は plugin/<plugin>/app/controller に生成。\n  - -P/--path で相対ディレクトリを指定可能（プロジェクトルート基準）。\n  - ファイルが既にある場合は上書き確認；-f/--force で直接上書き。",
            'ko' => "컨트롤러 파일 생성.\n\n권장:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\n참고:\n  - 기본 생성 위치 app/controller(기존 디렉터리 대소문자 따름).\n  - -p/--plugin 사용 시 plugin/<plugin>/app/controller에 생성.\n  - -P/--path로 프로젝트 루트 기준 상대 경로 지정 가능.\n  - 파일이 있으면 덮어쓸지 묻고, -f/--force로 직접 덮어쓰기.",
            'fr' => "Générer un fichier contrôleur.\n\nRecommandé :\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nNotes :\n  - Par défaut, génération sous app/controller (casse selon le répertoire existant).\n  - Avec -p/--plugin, génération sous plugin/<plugin>/app/controller.\n  - Avec -P/--path, génération dans le répertoire relatif indiqué (par rapport à la racine).\n  - Si le fichier existe, demande avant d'écraser ; -f/--force pour écraser directement.",
            'de' => "Controller-Datei erzeugen.\n\nEmpfohlen:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nHinweise:\n  - Standard: Erzeugung unter app/controller (Groß-/Kleinschreibung nach vorhandenem Verzeichnis).\n  - Mit -p/--plugin: unter plugin/<plugin>/app/controller.\n  - Mit -P/--path: unter angegebenem relativem Pfad (zur Projektwurzel).\n  - Bei vorhandener Datei wird gefragt; -f/--force überschreibt direkt.",
            'es' => "Generar un archivo de controlador.\n\nRecomendado:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nNotas:\n  - Por defecto se genera en app/controller (mayúsculas/minúsculas según el directorio existente).\n  - Con -p/--plugin se genera en plugin/<plugin>/app/controller.\n  - Con -P/--path se genera en el directorio relativo indicado (respecto a la raíz).\n  - Si el archivo existe, pregunta antes de sobrescribir; -f/--force sobrescribe directamente.",
            'pt_BR' => "Gerar um arquivo de controlador.\n\nRecomendado:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nNotas:\n  - Por padrão gera em app/controller (maiúsculas/minúsculas conforme o diretório existente).\n  - Com -p/--plugin gera em plugin/<plugin>/app/controller.\n  - Com -P/--path gera no diretório relativo indicado (em relação à raiz do projeto).\n  - Se o arquivo existir, pergunta antes de sobrescrever; -f/--force sobrescreve diretamente.",
            'ru' => "Создать файл контроллера.\n\nРекомендуется:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nПримечания:\n  - По умолчанию создаётся в app/controller (регистр по существующей директории).\n  - С -p/--plugin создаётся в plugin/<plugin>/app/controller.\n  - С -P/--path создаётся в указанной относительной директории (от корня проекта).\n  - Если файл существует, запрашивается подтверждение перезаписи; -f/--force перезаписывает сразу.",
            'vi' => "Tạo tệp controller.\n\nKhuyến nghị:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nLưu ý:\n  - Mặc định tạo trong app/controller (chữ hoa/thường theo thư mục hiện có).\n  - Với -p/--plugin tạo trong plugin/<plugin>/app/controller.\n  - Với -P/--path tạo trong thư mục tương đối chỉ định (so với thư mục gốc dự án).\n  - Nếu tệp đã tồn tại sẽ hỏi trước khi ghi đè; -f/--force ghi đè trực tiếp.",
            'tr' => "Controller dosyası oluştur.\n\nÖnerilen:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nNotlar:\n  - Varsayılan olarak app/controller altında oluşturulur (büyük/küçük harf mevcut dizine göre).\n  - -p/--plugin ile plugin/<plugin>/app/controller altında oluşturulur.\n  - -P/--path ile belirtilen göreli dizinde oluşturulur (proje köküne göre).\n  - Dosya varsa üzerine yazmadan önce sorar; -f/--force doğrudan üzerine yazar.",
            'id' => "Buat file controller.\n\nDirekomendasikan:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nCatatan:\n  - Secara default dibuat di app/controller (huruf mengikuti direktori yang ada).\n  - Dengan -p/--plugin dibuat di plugin/<plugin>/app/controller.\n  - Dengan -P/--path dibuat di direktori relatif yang ditentukan (terhadap akar proyek).\n  - Jika file sudah ada akan ditanya sebelum menimpa; -f/--force menimpa langsung.",
            'th' => "สร้างไฟล์คอนโทรลเลอร์\n\nแนะนำ:\n  php webman make:controller User\n  php webman make:controller User -p admin\n  php webman make:controller User -P plugin/admin/app/controller\n  php webman make:controller admin/User -f\n\nหมายเหตุ:\n  - ค่าเริ่มต้นสร้างใต้ app/controller (ตัวพิมพ์ตามไดเรกทอรีที่มีอยู่)\n  - ใช้ -p/--plugin สร้างใต้ plugin/<plugin>/app/controller\n  - ใช้ -P/--path สร้างในไดเรกทอรีสัมพัทธ์ที่ระบุ (เทียบกับรากโปรเจกต์)\n  - ถ้ามีไฟล์อยู่แล้วจะถามก่อนเขียนทับ ใช้ -f/--force เพื่อเขียนทับโดยตรง",
        ];
    }

    public static function getMakeMiddlewareMessages(): array
    {
        $zh = [
            'make_middleware' => '<info>创建中间件</info> <comment>{name}</comment>',
            'created' => '<info>已创建：</info> <comment>{path}</comment>',
            'configured' => '<info>已配置：</info> <comment>{class}</comment> -> <comment>{file}</comment>',
            'configured_exists' => '<comment>[Info]</comment> 配置已存在，跳过：{class} -> {file}',
            'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
            'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
        ];

        $en = [
            'make_middleware' => '<info>Make middleware</info> <comment>{name}</comment>',
            'created' => '<info>Created:</info> <comment>{path}</comment>',
            'configured' => '<info>Configured:</info> <comment>{class}</comment> -> <comment>{file}</comment>',
            'configured_exists' => '<comment>[Info]</comment> Already configured, skipped: {class} -> {file}',
            'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
            'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
            'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
        ];

        return [
            'zh_CN' => $zh, 
            'zh_TW' => [
                'make_middleware' => '<info>建立中間件</info> <comment>{name}</comment>',
                'created' => '<info>已建立：</info> <comment>{path}</comment>',
                'configured' => '<info>已設定：</info> <comment>{class}</comment> -> <comment>{file}</comment>',
                'configured_exists' => '<comment>[Info]</comment> 設定已存在，略過：{class} -> {file}',
                'override_prompt' => "<question>檔案已存在：{path}</question>\n<question>是否覆蓋？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>插件名稱無效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目錄下的目錄名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路徑無效：</error> <comment>{path}</comment> <error>。`--path/-P` 必須是相對路徑（相對於專案根目錄），不能是絕對路徑。</error>',
            ],
            'en' => $en,
            'ja' => [
                'make_middleware' => '<info>ミドルウェアを作成</info> <comment>{name}</comment>',
                'created' => '<info>作成しました：</info> <comment>{path}</comment>',
                'configured' => '<info>設定しました：</info> <comment>{class}</comment> -> <comment>{file}</comment>',
                'configured_exists' => '<comment>[Info]</comment> 既に設定済み、スキップ：{class} -> {file}',
                'override_prompt' => "<question>ファイルが既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>プラグイン名が無効です：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名で、/ または \\ を含めません。</error>',
                'invalid_path' => '<error>パスが無効です：</error> <comment>{path}</comment> <error>。`--path/-P` はプロジェクトルートからの相対パスで、絶対パスは不可です。</error>',
            ],
            'ko' => ['make_middleware' => '<info>미들웨어 만들기</info> <comment>{name}</comment>', 'created' => '<info>생성됨:</info> <comment>{path}</comment>', 'configured' => '<info>설정됨:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> 이미 설정됨, 건너뜀: {class} -> {file}', 'override_prompt' => "<question>파일이 이미 있습니다: {path}</question>\n<question>덮어쓸까요? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>잘못된 플러그인 이름: {plugin}. `--plugin/-p`는 plugin/ 아래 디렉터리 이름이며 / 또는 \\를 포함할 수 없습니다.</error>', 'invalid_path' => '<error>잘못된 경로: </error> <comment>{path}</comment> <error>. `--path/-P`는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 안 됩니다.</error>'],
            'fr' => ['make_middleware' => '<info>Créer un middleware</info> <comment>{name}</comment>', 'created' => '<info>Créé :</info> <comment>{path}</comment>', 'configured' => '<info>Configuré :</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Déjà configuré, ignoré : {class} -> {file}', 'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n", 'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de dossier sous plugin/, sans / ni \\.</error>', 'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. `--path/-P` doit être un chemin relatif (à la racine du projet), pas absolu.</error>'],
            'de' => ['make_middleware' => '<info>Middleware erstellen</info> <comment>{name}</comment>', 'created' => '<info>Erstellt:</info> <comment>{path}</comment>', 'configured' => '<info>Konfiguriert:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Bereits konfiguriert, übersprungen: {class} -> {file}', 'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Eingabe Standard: Y)</question>\n", 'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Ordnername unter plugin/ sein, ohne / oder \\.</error>', 'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. `--path/-P` muss ein relativer Pfad (zur Projektwurzel) sein, kein absoluter.</error>'],
            'es' => ['make_middleware' => '<info>Crear middleware</info> <comment>{name}</comment>', 'created' => '<info>Creado:</info> <comment>{path}</comment>', 'configured' => '<info>Configurado:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Ya configurado, omitido: {class} -> {file}', 'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nombre de plugin no válido: {plugin}. `--plugin/-p` debe ser un nombre de carpeta bajo plugin/, sin / ni \\.</error>', 'invalid_path' => '<error>Ruta no válida: </error> <comment>{path}</comment> <error>. `--path/-P` debe ser una ruta relativa (a la raíz del proyecto), no absoluta.</error>'],
            'pt_BR' => ['make_middleware' => '<info>Criar middleware</info> <comment>{name}</comment>', 'created' => '<info>Criado:</info> <comment>{path}</comment>', 'configured' => '<info>Configurado:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Já configurado, ignorado: {class} -> {file}', 'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de pasta em plugin/, sem / ou \\.</error>', 'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. `--path/-P` deve ser um caminho relativo (à raiz do projeto), não absoluto.</error>'],
            'ru' => ['make_middleware' => '<info>Создать middleware</info> <comment>{name}</comment>', 'created' => '<info>Создано:</info> <comment>{path}</comment>', 'configured' => '<info>Настроено:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Уже настроено, пропущено: {class} -> {file}', 'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/, без / или \\.</error>', 'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. `--path/-P` должен быть относительным путём (к корню проекта), не абсолютным.</error>'],
            'vi' => ['make_middleware' => '<info>Tạo middleware</info> <comment>{name}</comment>', 'created' => '<info>Đã tạo:</info> <comment>{path}</comment>', 'configured' => '<info>Đã cấu hình:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Đã cấu hình, bỏ qua: {class} -> {file}', 'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/, không chứa / hoặc \\.</error>', 'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. `--path/-P` phải là đường dẫn tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>'],
            'tr' => ['make_middleware' => '<info>Middleware oluştur</info> <comment>{name}</comment>', 'created' => '<info>Oluşturuldu:</info> <comment>{path}</comment>', 'configured' => '<info>Yapılandırıldı:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Zaten yapılandırılmış, atlandı: {class} -> {file}', 'override_prompt' => "<question>Dosya zaten mevcut: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altında bir klasör adı olmalı, / veya \\ içermemeli.</error>', 'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. `--path/-P` proje köküne göre göreli yol olmalı, mutlak yol olmamalı.</error>'],
            'id' => ['make_middleware' => '<info>Buat middleware</info> <comment>{name}</comment>', 'created' => '<info>Dibuat:</info> <comment>{path}</comment>', 'configured' => '<info>Dikonfigurasi:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> Sudah dikonfigurasi, dilewati: {class} -> {file}', 'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama folder di bawah plugin/, tidak boleh mengandung / atau \\.</error>', 'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. `--path/-P` harus path relatif (ke akar proyek), bukan absolut.</error>'],
            'th' => ['make_middleware' => '<info>สร้างมิดเดิลแวร์</info> <comment>{name}</comment>', 'created' => '<info>สร้างแล้ว:</info> <comment>{path}</comment>', 'configured' => '<info>ตั้งค่าแล้ว:</info> <comment>{class}</comment> -> <comment>{file}</comment>', 'configured_exists' => '<comment>[Info]</comment> ตั้งค่าแล้ว, ข้าม: {class} -> {file}', 'override_prompt' => "<question>มีไฟล์อยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n", 'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ ห้ามมี / หรือ \\.</error>', 'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. `--path/-P` ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่แบบสัมบูรณ์.</error>'],
        ];
    }

    public static function getMakeMiddlewareHelpText(): array
    {
        $en = "Generate a middleware file.\n\nRecommended:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nNotes:\n  - By default, it generates under app/middleware (case depends on existing directory).\n  - With -p/--plugin, it generates under plugin/<plugin>/app/middleware by default.\n  - With -P/--path, it generates under the specified relative directory (to project root).\n  - If the file already exists, it will ask before overriding; use -f/--force to override directly.";
        return [
            'zh_CN' => "生成中间件文件。\n\n推荐用法：\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\n说明：\n  - 默认生成到 app/middleware（大小写以现有目录为准）。\n  - 使用 -p/--plugin 时默认生成到 plugin/<plugin>/app/middleware。\n  - 使用 -P/--path 时生成到指定相对目录（相对于项目根目录）。\n  - 文件已存在时默认会提示是否覆盖；使用 -f/--force 可直接覆盖。",
            'zh_TW' => "建立中間件檔案。\n\n推薦用法：\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\n說明：\n  - 預設生成到 app/middleware（大小寫依現有目錄）。\n  - 使用 -p/--plugin 時預設生成到 plugin/<plugin>/app/middleware。\n  - 使用 -P/--path 時生成到指定相對目錄（相對於專案根目錄）。\n  - 檔案已存在時會詢問是否覆蓋；使用 -f/--force 可直接覆蓋。",
            'en' => $en,
            'ja' => "ミドルウェアファイルを生成。\n\n推奨：\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\n説明：\n  - デフォルトは app/middleware に生成（大文字小文字は既存ディレクトリに合わせる）。\n  - -p/--plugin の場合は plugin/<plugin>/app/middleware に生成。\n  - -P/--path で相対ディレクトリを指定可能（プロジェクトルート基準）。\n  - ファイルが既にある場合は上書き確認；-f/--force で直接上書き。",
            'ko' => "미들웨어 파일 생성.\n\n권장:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\n참고:\n  - 기본 생성 위치 app/middleware(기존 디렉터리 대소문자 따름).\n  - -p/--plugin 사용 시 plugin/<plugin>/app/middleware에 생성.\n  - -P/--path로 프로젝트 루트 기준 상대 경로 지정 가능.\n  - 파일이 있으면 덮어쓸지 묻고, -f/--force로 직접 덮어쓰기.",
            'fr' => "Générer un fichier middleware.\n\nRecommandé :\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nNotes :\n  - Par défaut, génération sous app/middleware (casse selon le répertoire existant).\n  - Avec -p/--plugin, génération sous plugin/<plugin>/app/middleware.\n  - Avec -P/--path, génération dans le répertoire relatif indiqué (par rapport à la racine).\n  - Si le fichier existe, demande avant d'écraser ; -f/--force pour écraser directement.",
            'de' => "Middleware-Datei erzeugen.\n\nEmpfohlen:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nHinweise:\n  - Standard: Erzeugung unter app/middleware (Groß-/Kleinschreibung nach vorhandenem Verzeichnis).\n  - Mit -p/--plugin: unter plugin/<plugin>/app/middleware.\n  - Mit -P/--path: unter angegebenem relativem Pfad (zur Projektwurzel).\n  - Bei vorhandener Datei wird gefragt; -f/--force überschreibt direkt.",
            'es' => "Generar un archivo de middleware.\n\nRecomendado:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nNotas:\n  - Por defecto se genera en app/middleware (mayúsculas/minúsculas según el directorio existente).\n  - Con -p/--plugin se genera en plugin/<plugin>/app/middleware.\n  - Con -P/--path se genera en el directorio relativo indicado (respecto a la raíz).\n  - Si el archivo existe, pregunta antes de sobrescribir; -f/--force sobrescribe directamente.",
            'pt_BR' => "Gerar um arquivo de middleware.\n\nRecomendado:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nNotas:\n  - Por padrão gera em app/middleware (maiúsculas/minúsculas conforme o diretório existente).\n  - Com -p/--plugin gera em plugin/<plugin>/app/middleware.\n  - Com -P/--path gera no diretório relativo indicado (em relação à raiz do projeto).\n  - Se o arquivo existir, pergunta antes de sobrescrever; -f/--force sobrescreve diretamente.",
            'ru' => "Создать файл middleware.\n\nРекомендуется:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nПримечания:\n  - По умолчанию создаётся в app/middleware (регистр по существующей директории).\n  - С -p/--plugin создаётся в plugin/<plugin>/app/middleware.\n  - С -P/--path создаётся в указанной относительной директории (от корня проекта).\n  - Если файл существует, запрашивается подтверждение перезаписи; -f/--force перезаписывает сразу.",
            'vi' => "Tạo tệp middleware.\n\nKhuyến nghị:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nLưu ý:\n  - Mặc định tạo trong app/middleware (chữ hoa/thường theo thư mục hiện có).\n  - Với -p/--plugin tạo trong plugin/<plugin>/app/middleware.\n  - Với -P/--path tạo trong thư mục tương đối chỉ định (so với thư mục gốc dự án).\n  - Nếu tệp đã tồn tại sẽ hỏi trước khi ghi đè; -f/--force ghi đè trực tiếp.",
            'tr' => "Middleware dosyası oluştur.\n\nÖnerilen:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nNotlar:\n  - Varsayılan olarak app/middleware altında oluşturulur (büyük/küçük harf mevcut dizine göre).\n  - -p/--plugin ile plugin/<plugin>/app/middleware altında oluşturulur.\n  - -P/--path ile belirtilen göreli dizinde oluşturulur (proje köküne göre).\n  - Dosya varsa üzerine yazmadan önce sorar; -f/--force doğrudan üzerine yazar.",
            'id' => "Buat file middleware.\n\nDirekomendasikan:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nCatatan:\n  - Secara default dibuat di app/middleware (huruf mengikuti direktori yang ada).\n  - Dengan -p/--plugin dibuat di plugin/<plugin>/app/middleware.\n  - Dengan -P/--path dibuat di direktori relatif yang ditentukan (terhadap akar proyek).\n  - Jika file sudah ada akan ditanya sebelum menimpa; -f/--force menimpa langsung.",
            'th' => "สร้างไฟล์มิดเดิลแวร์\n\nแนะนำ:\n  php webman make:middleware Auth\n  php webman make:middleware Auth -p admin\n  php webman make:middleware Auth -P plugin/admin/app/middleware\n  php webman make:middleware Api/Auth -f\n\nหมายเหตุ:\n  - ค่าเริ่มต้นสร้างใต้ app/middleware (ตัวพิมพ์ตามไดเรกทอรีที่มีอยู่)\n  - ใช้ -p/--plugin สร้างใต้ plugin/<plugin>/app/middleware\n  - ใช้ -P/--path สร้างในไดเรกทอรีสัมพัทธ์ที่ระบุ (เทียบกับรากโปรเจกต์)\n  - ถ้ามีไฟล์อยู่แล้วจะถามก่อนเขียนทับ ใช้ -f/--force เพื่อเขียนทับโดยตรง",
        ];
    }

    public static function getMakeCommandMessages(): array
    {
        return [
            'zh_CN' => [
                'make_command' => '<info>创建命令</info> <comment>{name}</comment>',
                'created' => '<info>已创建：</info> <comment>{path}</comment>',
                'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
                'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
                'invalid_command' => '<error>命令名不能为空。</error>',
            ],
            'zh_TW' => [
                'make_command' => '<info>建立命令</info> <comment>{name}</comment>',
                'created' => '<info>已建立：</info> <comment>{path}</comment>',
                'override_prompt' => "<question>檔案已存在：{path}</question>\n<question>是否覆蓋？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>插件名稱無效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目錄下的目錄名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路徑無效：</error> <comment>{path}</comment> <error>。`--path/-P` 必須是相對路徑（相對於專案根目錄），不能是絕對路徑。</error>',
                'invalid_command' => '<error>命令名稱不可為空。</error>',
            ],
            'en' => [
                'make_command' => '<info>Make command</info> <comment>{name}</comment>',
                'created' => '<info>Created:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
                'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
                'invalid_command' => '<error>Command name cannot be empty.</error>',
            ],
            'ja' => [
                'make_command' => '<info>コマンドを作成</info> <comment>{name}</comment>',
                'created' => '<info>作成しました：</info> <comment>{path}</comment>',
                'override_prompt' => "<question>ファイルが既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>プラグイン名が無効です：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名で、/ または \\ を含めません。</error>',
                'invalid_path' => '<error>パスが無効です：</error> <comment>{path}</comment> <error>。`--path/-P` はプロジェクトルートからの相対パスで、絶対パスは不可です。</error>',
                'invalid_command' => '<error>コマンド名を空にできません。</error>',
            ],
            'ko' => [
                'make_command' => '<info>명령 만들기</info> <comment>{name}</comment>',
                'created' => '<info>생성됨:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>파일이 이미 있습니다: {path}</question>\n<question>덮어쓸까요? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>잘못된 플러그인 이름: {plugin}. `--plugin/-p`는 plugin/ 아래 디렉터리 이름이며 / 또는 \\를 포함할 수 없습니다.</error>',
                'invalid_path' => '<error>잘못된 경로: </error> <comment>{path}</comment> <error>. `--path/-P`는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 안 됩니다.</error>',
                'invalid_command' => '<error>명령 이름이 비어 있을 수 없습니다.</error>',
            ],
            'fr' => [
                'make_command' => '<info>Créer une commande</info> <comment>{name}</comment>',
                'created' => '<info>Créé :</info> <comment>{path}</comment>',
                'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n",
                'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de dossier sous plugin/, sans / ni \\.</error>',
                'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. `--path/-P` doit être un chemin relatif (à la racine du projet), pas absolu.</error>',
                'invalid_command' => '<error>Le nom de la commande ne peut pas être vide.</error>',
            ],
            'de' => [
                'make_command' => '<info>Befehl erstellen</info> <comment>{name}</comment>',
                'created' => '<info>Erstellt:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Eingabe Standard: Y)</question>\n",
                'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Ordnername unter plugin/ sein, ohne / oder \\.</error>',
                'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. `--path/-P` muss ein relativer Pfad (zur Projektwurzel) sein, kein absoluter.</error>',
                'invalid_command' => '<error>Der Befehlsname darf nicht leer sein.</error>',
            ],
            'es' => [
                'make_command' => '<info>Crear comando</info> <comment>{name}</comment>',
                'created' => '<info>Creado:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nombre de plugin no válido: {plugin}. `--plugin/-p` debe ser un nombre de carpeta bajo plugin/, sin / ni \\.</error>',
                'invalid_path' => '<error>Ruta no válida: </error> <comment>{path}</comment> <error>. `--path/-P` debe ser una ruta relativa (a la raíz del proyecto), no absoluta.</error>',
                'invalid_command' => '<error>El nombre del comando no puede estar vacío.</error>',
            ],
            'pt_BR' => [
                'make_command' => '<info>Criar comando</info> <comment>{name}</comment>',
                'created' => '<info>Criado:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de pasta em plugin/, sem / ou \\.</error>',
                'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. `--path/-P` deve ser um caminho relativo (à raiz do projeto), não absoluto.</error>',
                'invalid_command' => '<error>O nome do comando não pode estar vazio.</error>',
            ],
            'ru' => [
                'make_command' => '<info>Создать команду</info> <comment>{name}</comment>',
                'created' => '<info>Создано:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/, без / или \\.</error>',
                'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. `--path/-P` должен быть относительным путём (к корню проекта), не абсолютным.</error>',
                'invalid_command' => '<error>Имя команды не может быть пустым.</error>',
            ],
            'vi' => [
                'make_command' => '<info>Tạo lệnh</info> <comment>{name}</comment>',
                'created' => '<info>Đã tạo:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/, không chứa / hoặc \\.</error>',
                'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. `--path/-P` phải là đường dẫn tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>',
                'invalid_command' => '<error>Tên lệnh không được để trống.</error>',
            ],
            'tr' => [
                'make_command' => '<info>Komut oluştur</info> <comment>{name}</comment>',
                'created' => '<info>Oluşturuldu:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>Dosya zaten mevcut: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altında bir klasör adı olmalı, / veya \\ içermemeli.</error>',
                'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. `--path/-P` proje köküne göre göreli yol olmalı, mutlak yol olmamalı.</error>',
                'invalid_command' => '<error>Komut adı boş olamaz.</error>',
            ],
            'id' => [
                'make_command' => '<info>Buat perintah</info> <comment>{name}</comment>',
                'created' => '<info>Dibuat:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama folder di bawah plugin/, tidak boleh mengandung / atau \\.</error>',
                'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. `--path/-P` harus path relatif (ke akar proyek), bukan absolut.</error>',
                'invalid_command' => '<error>Nama perintah tidak boleh kosong.</error>',
            ],
            'th' => [
                'make_command' => '<info>สร้างคำสั่ง</info> <comment>{name}</comment>',
                'created' => '<info>สร้างแล้ว:</info> <comment>{path}</comment>',
                'override_prompt' => "<question>มีไฟล์อยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ และห้ามมี / หรือ \\.</error>',
                'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. `--path/-P` ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่แบบสัมบูรณ์</error>',
                'invalid_command' => '<error>ชื่อคำสั่งต้องไม่ว่าง</error>',
            ],
        ];
    }

    public static function getMakeCommandHelpText(): array
    {
        $helps = [
            'zh_CN' => "生成 Console 命令类（Symfony Console）。\n\n推荐用法：\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\n说明：\n  - 命令名支持冒号分段（例如 user:list），生成类名会自动转为驼峰（UserList）。\n  - 默认生成到 app/command（大小写以现有目录为准）。\n  - 使用 -p/--plugin 时默认生成到 plugin/<plugin>/app/command。\n  - 使用 -P/--path 时生成到指定相对目录（相对于项目根目录）。\n  - 文件已存在时默认会提示是否覆盖；使用 -f/--force 可直接覆盖。",
            'zh_TW' => "建立 Console 命令類（Symfony Console）。\n\n推薦用法：\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\n說明：\n  - 命令名支援冒號分段（如 user:list），類名會自動轉為駝峰（UserList）。\n  - 預設生成到 app/command（大小寫依現有目錄）。\n  - 使用 -p/--plugin 時預設生成到 plugin/<plugin>/app/command。\n  - 使用 -P/--path 時生成到指定相對目錄（相對於專案根目錄）。\n  - 檔案已存在時會詢問是否覆蓋；使用 -f/--force 可直接覆蓋。",
            'en' => "Generate a Console command class (Symfony Console).\n\nRecommended:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nNotes:\n  - Command name supports colon segments (e.g. user:list). The class name will be camel-cased (UserList).\n  - By default, it generates under app/command (case depends on existing directory).\n  - With -p/--plugin, it generates under plugin/<plugin>/app/command by default.\n  - With -P/--path, it generates under the specified relative directory (to project root).\n  - If the file already exists, it will ask before overriding; use -f/--force to override directly.",
            'ja' => "Console コマンドクラスを生成（Symfony Console）。\n\n推奨：\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\n説明：\n  - コマンド名はコロン区切り（例 user:list）に対応。クラス名はキャメルケース（UserList）になります。\n  - デフォルトは app/command に生成（大文字小文字は既存ディレクトリに合わせる）。\n  - -p/--plugin の場合は plugin/<plugin>/app/command に生成。\n  - -P/--path で相対ディレクトリを指定可能（プロジェクトルート基準）。\n  - ファイルが既にある場合は上書き確認；-f/--force で直接上書き。",
            'ko' => "Console 명령 클래스 생성 (Symfony Console).\n\n권장:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\n참고:\n  - 명령 이름은 콜론 구분(예: user:list) 지원. 클래스명은 캐멀케이스(UserList)로 생성.\n  - 기본 생성 위치 app/command(기존 디렉터리 대소문자 따름).\n  - -p/--plugin 사용 시 plugin/<plugin>/app/command에 생성.\n  - -P/--path로 프로젝트 루트 기준 상대 경로 지정 가능.\n  - 파일이 있으면 덮어쓸지 묻고, -f/--force로 직접 덮어쓰기.",
            'fr' => "Générer une classe de commande Console (Symfony Console).\n\nRecommandé :\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nNotes :\n  - Le nom de commande peut contenir des deux-points (ex. user:list), le nom de classe sera en camelCase (UserList).\n  - Par défaut, génération sous app/command (casse selon le répertoire existant).\n  - Avec -p/--plugin, génération sous plugin/<plugin>/app/command.\n  - Avec -P/--path, génération dans le répertoire relatif indiqué (par rapport à la racine).\n  - Si le fichier existe, demande avant d'écraser ; -f/--force pour écraser directement.",
            'de' => "Eine Console-Befehlsklasse erzeugen (Symfony Console).\n\nEmpfohlen:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nHinweise:\n  - Befehlsname kann Doppelpunkte enthalten (z. B. user:list), Klassenname wird zu CamelCase (UserList).\n  - Standard: Erzeugung unter app/command (Groß-/Kleinschreibung nach vorhandenem Verzeichnis).\n  - Mit -p/--plugin: unter plugin/<plugin>/app/command.\n  - Mit -P/--path: unter angegebenem relativem Pfad (zur Projektwurzel).\n  - Bei vorhandener Datei wird gefragt; -f/--force überschreibt direkt.",
            'es' => "Generar una clase de comando Console (Symfony Console).\n\nRecomendado:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nNotas:\n  - El nombre del comando admite segmentos con dos puntos (ej. user:list). El nombre de clase será en camelCase (UserList).\n  - Por defecto se genera en app/command (mayúsculas según el directorio existente).\n  - Con -p/--plugin se genera en plugin/<plugin>/app/command.\n  - Con -P/--path se genera en el directorio relativo indicado (respecto a la raíz).\n  - Si el archivo existe, pregunta antes de sobrescribir; -f/--force sobrescribe directamente.",
            'pt_BR' => "Gerar uma classe de comando Console (Symfony Console).\n\nRecomendado:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nNotas:\n  - O nome do comando aceita segmentos com dois pontos (ex. user:list). O nome da classe será em camelCase (UserList).\n  - Por padrão gera em app/command (maiúsculas conforme o diretório existente).\n  - Com -p/--plugin gera em plugin/<plugin>/app/command.\n  - Com -P/--path gera no diretório relativo indicado (em relação à raiz do projeto).\n  - Se o arquivo existir, pergunta antes de sobrescrever; -f/--force sobrescreve diretamente.",
            'ru' => "Создать класс команды Console (Symfony Console).\n\nРекомендуется:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nПримечания:\n  - Имя команды может содержать двоеточие (напр. user:list), имя класса будет в camelCase (UserList).\n  - По умолчанию создаётся в app/command (регистр по существующей директории).\n  - С -p/--plugin создаётся в plugin/<plugin>/app/command.\n  - С -P/--path создаётся в указанной относительной директории (от корня проекта).\n  - Если файл существует, запрашивается подтверждение перезаписи; -f/--force перезаписывает сразу.",
            'vi' => "Tạo lớp lệnh Console (Symfony Console).\n\nKhuyến nghị:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nLưu ý:\n  - Tên lệnh hỗ trợ phân đoạn bằng dấu hai chấm (vd. user:list), tên lớp sẽ là camelCase (UserList).\n  - Mặc định tạo trong app/command (chữ hoa/thường theo thư mục hiện có).\n  - Với -p/--plugin tạo trong plugin/<plugin>/app/command.\n  - Với -P/--path tạo trong thư mục tương đối chỉ định (so với thư mục gốc dự án).\n  - Nếu tệp đã tồn tại sẽ hỏi trước khi ghi đè; -f/--force ghi đè trực tiếp.",
            'tr' => "Bir Console komut sınıfı oluştur (Symfony Console).\n\nÖnerilen:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nNotlar:\n  - Komut adı iki nokta ile ayrılmış parçalar destekler (örn. user:list), sınıf adı camelCase (UserList) olur.\n  - Varsayılan olarak app/command altında oluşturulur (büyük/küçük harf mevcut dizine göre).\n  - -p/--plugin ile plugin/<plugin>/app/command altında oluşturulur.\n  - -P/--path ile belirtilen göreli dizinde oluşturulur (proje köküne göre).\n  - Dosya varsa üzerine yazmadan önce sorar; -f/--force doğrudan üzerine yazar.",
            'id' => "Buat kelas perintah Console (Symfony Console).\n\nDirekomendasikan:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nCatatan:\n  - Nama perintah mendukung segmen dengan titik dua (mis. user:list), nama kelas akan camelCase (UserList).\n  - Secara default dibuat di app/command (huruf mengikuti direktori yang ada).\n  - Dengan -p/--plugin dibuat di plugin/<plugin>/app/command.\n  - Dengan -P/--path dibuat di direktori relatif yang ditentukan (terhadap akar proyek).\n  - Jika file sudah ada akan ditanya sebelum menimpa; -f/--force menimpa langsung.",
            'th' => "สร้างคลาสคำสั่ง Console (Symfony Console)\n\nแนะนำ:\n  php webman make:command user:list\n  php webman make:command user:list -p admin\n  php webman make:command user:list -P plugin/admin/app/command\n  php webman make:command user:list -f\n\nหมายเหตุ:\n  - ชื่อคำสั่งรองรับส่วนที่คั่นด้วยโคลอน (เช่น user:list) ชื่อคลาสจะเป็น camelCase (UserList)\n  - ค่าเริ่มต้นสร้างใต้ app/command (ตัวพิมพ์ตามไดเรกทอรีที่มีอยู่)\n  - ใช้ -p/--plugin สร้างใต้ plugin/<plugin>/app/command\n  - ใช้ -P/--path สร้างในไดเรกทอรีสัมพัทธ์ที่ระบุ (เทียบกับรากโปรเจกต์)\n  - ถ้ามีไฟล์อยู่แล้วจะถามก่อนเขียนทับ ใช้ -f/--force เพื่อเขียนทับโดยตรง",
        ];
        return $helps;
    }

    public static function getMakeBootstrapMessages(): array
    {
        return [
            'zh_CN' => [
                'make_bootstrap' => '<info>创建启动项</info> <comment>{name}</comment>',
                'created' => '<info>已创建：</info> <comment>{path}</comment>',
                'enabled' => '<info>已启用：</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> 已存在，无需重复写入：{class}',
                'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
                'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
                'arg_name' => '启动项名称',
                'arg_enable' => '是否启用',
                'opt_plugin' => '插件名称（plugin/ 下的目录名，例如 admin）',
                'opt_path' => '目标目录（相对于项目根目录，例如 plugin/admin/app/bootstrap）',
                'opt_force' => '强制覆盖',
            ],
            'zh_TW' => [
                'make_bootstrap' => '<info>建立啟動項</info> <comment>{name}</comment>',
                'created' => '<info>已建立：</info> <comment>{path}</comment>',
                'enabled' => '<info>已啟用：</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> 已存在，無需重複寫入：{class}',
                'override_prompt' => "<question>檔案已存在：{path}</question>\n<question>是否覆蓋？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>插件名稱無效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目錄下的目錄名，不能包含 / 或 \\。</error>',
                'invalid_path' => '<error>路徑無效：</error> <comment>{path}</comment> <error>。`--path/-P` 必須是相對路徑（相對於專案根目錄），不能是絕對路徑。</error>',
                'arg_name' => '啟動項名稱',
                'arg_enable' => '是否啟用',
                'opt_plugin' => '插件名稱（plugin/ 下的目錄名，例如 admin）',
                'opt_path' => '目標目錄（相對於專案根目錄，例如 plugin/admin/app/bootstrap）',
                'opt_force' => '強制覆蓋',
            ],
            'en' => [
                'make_bootstrap' => '<info>Make bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Created:</info> <comment>{path}</comment>',
                'enabled' => '<info>Enabled:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Already exists, skipped: {class}',
                'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
                'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
                'arg_name' => 'Bootstrap name',
                'arg_enable' => 'Whether to enable',
                'opt_plugin' => 'Plugin name under plugin/. e.g. admin',
                'opt_path' => 'Target directory (relative to project root). e.g. plugin/admin/app/bootstrap',
                'opt_force' => 'Override existing file without confirmation.',
            ],
            'ja' => [
                'make_bootstrap' => '<info>Bootstrap を作成</info> <comment>{name}</comment>',
                'created' => '<info>作成しました：</info> <comment>{path}</comment>',
                'enabled' => '<info>有効にしました：</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> 既に存在します、スキップ：{class}',
                'override_prompt' => "<question>ファイルが既に存在します：{path}</question>\n<question>上書きしますか？[Y/n]（Enter default: Y）</question>\n",
                'invalid_plugin' => '<error>プラグイン名が無効です：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` は plugin/ 以下のディレクトリ名で、/ または \\ を含めません。</error>',
                'invalid_path' => '<error>パスが無効です：</error> <comment>{path}</comment> <error>。`--path/-P` はプロジェクトルートからの相対パスで、絶対パスは不可です。</error>',
                'arg_name' => 'Bootstrap名',
                'arg_enable' => '有効にするか',
                'opt_plugin' => 'plugin/ 以下のプラグイン名。例: admin',
                'opt_path' => '出力先ディレクトリ（プロジェクトルートからの相対パス）。例: plugin/admin/app/bootstrap',
                'opt_force' => '確認せずに既存ファイルを上書き',
            ],
            'ko' => [
                'make_bootstrap' => '<info>Bootstrap 생성</info> <comment>{name}</comment>',
                'created' => '<info>생성됨:</info> <comment>{path}</comment>',
                'enabled' => '<info>활성화됨:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> 이미 있음, 건너뜀: {class}',
                'override_prompt' => "<question>파일이 이미 있습니다: {path}</question>\n<question>덮어쓸까요? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>잘못된 플러그인 이름: {plugin}. `--plugin/-p`는 plugin/ 아래 디렉터리 이름이며 / 또는 \\를 포함할 수 없습니다.</error>',
                'invalid_path' => '<error>잘못된 경로: </error> <comment>{path}</comment> <error>. `--path/-P`는 프로젝트 루트 기준 상대 경로여야 하며 절대 경로는 안 됩니다.</error>',
                'arg_name' => 'Bootstrap 이름',
                'arg_enable' => '활성화 여부',
                'opt_plugin' => 'plugin/ 아래 플러그인 이름. 예: admin',
                'opt_path' => '대상 디렉터리(프로젝트 루트 기준 상대 경로). 예: plugin/admin/app/bootstrap',
                'opt_force' => '확인 없이 기존 파일 덮어쓰기',
            ],
            'fr' => [
                'make_bootstrap' => '<info>Créer un Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Créé :</info> <comment>{path}</comment>',
                'enabled' => '<info>Activé :</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Déjà présent, ignoré : {class}',
                'override_prompt' => "<question>Le fichier existe déjà : {path}</question>\n<question>Écraser ? [Y/n] (Entrée par défaut: Y)</question>\n",
                'invalid_plugin' => '<error>Nom de plugin invalide : {plugin}. `--plugin/-p` doit être un nom de dossier sous plugin/, sans / ni \\.</error>',
                'invalid_path' => '<error>Chemin invalide : </error> <comment>{path}</comment> <error>. `--path/-P` doit être un chemin relatif (à la racine du projet), pas absolu.</error>',
                'arg_name' => 'Nom du bootstrap',
                'arg_enable' => 'Activer ou non',
                'opt_plugin' => 'Nom du plugin sous plugin/. ex. admin',
                'opt_path' => 'Répertoire cible (relatif à la racine du projet). ex. plugin/admin/app/bootstrap',
                'opt_force' => 'Écraser sans confirmation',
            ],
            'de' => [
                'make_bootstrap' => '<info>Bootstrap erstellen</info> <comment>{name}</comment>',
                'created' => '<info>Erstellt:</info> <comment>{path}</comment>',
                'enabled' => '<info>Aktiviert:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Bereits vorhanden, übersprungen: {class}',
                'override_prompt' => "<question>Datei existiert bereits: {path}</question>\n<question>Überschreiben? [Y/n] (Eingabe Standard: Y)</question>\n",
                'invalid_plugin' => '<error>Ungültiger Plugin-Name: {plugin}. `--plugin/-p` muss ein Ordnername unter plugin/ sein, ohne / oder \\.</error>',
                'invalid_path' => '<error>Ungültiger Pfad: </error> <comment>{path}</comment> <error>. `--path/-P` muss ein relativer Pfad (zur Projektwurzel) sein, kein absoluter.</error>',
                'arg_name' => 'Bootstrap-Name',
                'arg_enable' => 'Aktivieren oder nicht',
                'opt_plugin' => 'Plugin-Name unter plugin/. z.B. admin',
                'opt_path' => 'Zielverzeichnis (relativ zur Projektwurzel). z.B. plugin/admin/app/bootstrap',
                'opt_force' => 'Vorhandene Datei ohne Nachfrage überschreiben',
            ],
            'es' => [
                'make_bootstrap' => '<info>Crear Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Creado:</info> <comment>{path}</comment>',
                'enabled' => '<info>Habilitado:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Ya existe, omitido: {class}',
                'override_prompt' => "<question>El archivo ya existe: {path}</question>\n<question>¿Sobrescribir? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nombre de plugin no válido: {plugin}. `--plugin/-p` debe ser un nombre de carpeta bajo plugin/, sin / ni \\.</error>',
                'invalid_path' => '<error>Ruta no válida: </error> <comment>{path}</comment> <error>. `--path/-P` debe ser una ruta relativa (a la raíz del proyecto), no absoluta.</error>',
                'arg_name' => 'Nombre del bootstrap',
                'arg_enable' => 'Activar o no',
                'opt_plugin' => 'Nombre del plugin bajo plugin/. ej. admin',
                'opt_path' => 'Directorio destino (relativo a la raíz del proyecto). ej. plugin/admin/app/bootstrap',
                'opt_force' => 'Sobrescribir sin confirmación',
            ],
            'pt_BR' => [
                'make_bootstrap' => '<info>Criar Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Criado:</info> <comment>{path}</comment>',
                'enabled' => '<info>Habilitado:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Já existe, ignorado: {class}',
                'override_prompt' => "<question>O arquivo já existe: {path}</question>\n<question>Sobrescrever? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nome de plugin inválido: {plugin}. `--plugin/-p` deve ser um nome de pasta em plugin/, sem / ou \\.</error>',
                'invalid_path' => '<error>Caminho inválido: </error> <comment>{path}</comment> <error>. `--path/-P` deve ser um caminho relativo (à raiz do projeto), não absoluto.</error>',
                'arg_name' => 'Nome do bootstrap',
                'arg_enable' => 'Ativar ou não',
                'opt_plugin' => 'Nome do plugin em plugin/. ex: admin',
                'opt_path' => 'Diretório alvo (relativo à raiz do projeto). ex: plugin/admin/app/bootstrap',
                'opt_force' => 'Sobrescrever sem confirmação',
            ],
            'ru' => [
                'make_bootstrap' => '<info>Создать Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Создано:</info> <comment>{path}</comment>',
                'enabled' => '<info>Включено:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Уже есть, пропущено: {class}',
                'override_prompt' => "<question>Файл уже существует: {path}</question>\n<question>Перезаписать? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Недопустимое имя плагина: {plugin}. `--plugin/-p` должно быть именем каталога в plugin/, без / или \\.</error>',
                'invalid_path' => '<error>Недопустимый путь: </error> <comment>{path}</comment> <error>. `--path/-P` должен быть относительным путём (к корню проекта), не абсолютным.</error>',
                'arg_name' => 'Tên bootstrap',
                'arg_enable' => 'Bật hay không',
                'opt_plugin' => 'Tên plugin trong plugin/. vd: admin',
                'opt_path' => 'Thư mục đích (tương đối so với thư mục gốc dự án). vd: plugin/admin/app/bootstrap',
                'opt_force' => 'Ghi đè không cần xác nhận',
            ],
            'vi' => [
                'make_bootstrap' => '<info>Tạo Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Đã tạo:</info> <comment>{path}</comment>',
                'enabled' => '<info>Đã bật:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Đã tồn tại, bỏ qua: {class}',
                'override_prompt' => "<question>Tệp đã tồn tại: {path}</question>\n<question>Ghi đè? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Tên plugin không hợp lệ: {plugin}. `--plugin/-p` phải là tên thư mục trong plugin/, không chứa / hoặc \\.</error>',
                'invalid_path' => '<error>Đường dẫn không hợp lệ: </error> <comment>{path}</comment> <error>. `--path/-P` phải là đường dẫn tương đối (tới thư mục gốc dự án), không phải tuyệt đối.</error>',
                'arg_name' => 'Tên bootstrap',
                'arg_enable' => 'Kích hoạt hay không',
                'opt_plugin' => 'Tên plugin trong plugin/. vd: admin',
                'opt_path' => 'Thư mục đích (tương đối so với thư mục gốc). vd: plugin/admin/app/bootstrap',
                'opt_force' => 'Ghi đè không cần xác nhận',
            ],
            'tr' => [
                'make_bootstrap' => '<info>Bootstrap oluştur</info> <comment>{name}</comment>',
                'created' => '<info>Oluşturuldu:</info> <comment>{path}</comment>',
                'enabled' => '<info>Etkinleştirildi:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Zaten mevcut, atlandı: {class}',
                'override_prompt' => "<question>Dosya zaten mevcut: {path}</question>\n<question>Üzerine yazılsın mı? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Geçersiz eklenti adı: {plugin}. `--plugin/-p` plugin/ altında bir klasör adı olmalı, / veya \\ içermemeli.</error>',
                'invalid_path' => '<error>Geçersiz yol: </error> <comment>{path}</comment> <error>. `--path/-P` proje köküne göre göreli yol olmalı, mutlak yol olmamalı.</error>',
                'arg_name' => 'Bootstrap adı',
                'arg_enable' => 'Etkinleştirilsin mi',
                'opt_plugin' => 'plugin/ altında eklenti adı. örn: admin',
                'opt_path' => 'Hedef dizin (proje köküne göre göreli). örn: plugin/admin/app/bootstrap',
                'opt_force' => 'Onay almadan üzerine yaz',
            ],
            'id' => [
                'make_bootstrap' => '<info>Buat Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>Dibuat:</info> <comment>{path}</comment>',
                'enabled' => '<info>Diaktifkan:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> Sudah ada, dilewati: {class}',
                'override_prompt' => "<question>File sudah ada: {path}</question>\n<question>Timpa? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>Nama plugin tidak valid: {plugin}. `--plugin/-p` harus nama folder di bawah plugin/, tidak boleh mengandung / atau \\.</error>',
                'invalid_path' => '<error>Path tidak valid: </error> <comment>{path}</comment> <error>. `--path/-P` harus path relatif (ke akar proyek), bukan absolut.</error>',
                'arg_name' => 'Nama bootstrap',
                'arg_enable' => 'Aktifkan atau tidak',
                'opt_plugin' => 'Nama plugin di plugin/. mis: admin',
                'opt_path' => 'Direktori tujuan (relatif ke akar proyek). mis: plugin/admin/app/bootstrap',
                'opt_force' => 'Timpa tanpa konfirmasi',
            ],
            'th' => [
                'make_bootstrap' => '<info>สร้าง Bootstrap</info> <comment>{name}</comment>',
                'created' => '<info>สร้างแล้ว:</info> <comment>{path}</comment>',
                'enabled' => '<info>เปิดใช้งานแล้ว:</info> <comment>{class}</comment>',
                'enabled_exists' => '<comment>[Info]</comment> มีอยู่แล้ว ข้าม: {class}',
                'override_prompt' => "<question>มีไฟล์อยู่แล้ว: {path}</question>\n<question>เขียนทับ? [Y/n] (Enter default: Y)</question>\n",
                'invalid_plugin' => '<error>ชื่อปลั๊กอินไม่ถูกต้อง: {plugin}. `--plugin/-p` ต้องเป็นชื่อโฟลเดอร์ภายใต้ plugin/ ห้ามมี / หรือ \\</error>',
                'invalid_path' => '<error>เส้นทางไม่ถูกต้อง: </error> <comment>{path}</comment> <error>. `--path/-P` ต้องเป็นเส้นทางสัมพัทธ์ (จากรากโปรเจกต์) ไม่ใช่แบบสัมบูรณ์</error>',
                'arg_name' => 'ชื่อ Bootstrap',
                'arg_enable' => 'เปิดใช้งานหรือไม่',
                'opt_plugin' => 'ชื่อปลั๊กอินภายใต้ plugin/. เช่น admin',
                'opt_path' => 'โฟลเดอร์ปลายทาง (สัมพัทธ์จากรากโปรเจกต์). เช่น plugin/admin/app/bootstrap',
                'opt_force' => 'เขียนทับโดยไม่ยืนยัน',
            ],
        ];

        return $messages;
    }

    public static function getMakeBootstrapHelpText(): array
    {
        return [
            'zh_CN' => "生成 Bootstrap 启动项类（实现 Webman\\Bootstrap）。\n\n推荐用法：\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\n说明：\n  - 默认生成到 app/bootstrap（大小写以现有目录为准）。\n  - 使用 -p/--plugin 时默认生成到 plugin/<plugin>/app/bootstrap。\n  - 使用 -P/--path 时生成到指定相对目录（相对于项目根目录）。\n  - enable 位置参数用于控制是否写入 config/bootstrap.php（默认启用；传 no/false/0/off 等表示不启用）。\n  - 文件已存在时默认会提示是否覆盖；使用 -f/--force 可直接覆盖。",
            'zh_TW' => "建立 Bootstrap 啟動項類（實作 Webman\\Bootstrap）。\n\n推薦用法：\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\n說明：\n  - 預設生成到 app/bootstrap（大小寫依現有目錄）。\n  - 使用 -p/--plugin 時預設生成到 plugin/<plugin>/app/bootstrap。\n  - 使用 -P/--path 時生成到指定相對目錄（相對於專案根目錄）。\n  - enable 位置參數用於控制是否寫入 config/bootstrap.php（預設啟用；傳 no/false/0/off 表示不啟用）。\n  - 檔案已存在時會詢問是否覆蓋；使用 -f/--force 可直接覆蓋。",
            'en' => "Generate a Bootstrap class (implements Webman\\Bootstrap).\n\nRecommended:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nNotes:\n  - By default, it generates under app/bootstrap (case depends on existing directory).\n  - With -p/--plugin, it generates under plugin/<plugin>/app/bootstrap by default.\n  - With -P/--path, it generates under the specified relative directory (to project root).\n  - The positional `enable` argument controls whether to append to config/bootstrap.php (enabled by default; use no/false/0/off to disable).\n  - If the file already exists, it will ask before overriding; use -f/--force to override directly.",
            'ja' => "Bootstrap クラスを生成（Webman\\Bootstrap を実装）。\n\n推奨：\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\n説明：\n  - デフォルトは app/bootstrap に生成（大文字小文字は既存ディレクトリに合わせる）。\n  - -p/--plugin の場合は plugin/<plugin>/app/bootstrap に生成。\n  - -P/--path で相対ディレクトリを指定可能（プロジェクトルート基準）。\n  - 位置引数 enable で config/bootstrap.php に追記するか制御（デフォルト有効；no/false/0/off で無効）。\n  - ファイルが既にある場合は上書き確認；-f/--force で直接上書き。",
            'ko' => "Bootstrap 클래스 생성 (Webman\\Bootstrap 구현).\n\n권장:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\n참고:\n  - 기본 생성 위치 app/bootstrap(기존 디렉터리 대소문자 따름).\n  - -p/--plugin 사용 시 plugin/<plugin>/app/bootstrap에 생성.\n  - -P/--path로 프로젝트 루트 기준 상대 경로 지정 가능.\n  - 위치 인자 enable으로 config/bootstrap.php 추가 여부 제어(기본 활성화; no/false/0/off로 비활성화).\n  - 파일이 있으면 덮어쓸지 묻고, -f/--force로 직접 덮어쓰기.",
            'fr' => "Générer une classe Bootstrap (implémente Webman\\Bootstrap).\n\nRecommandé :\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nNotes :\n  - Par défaut, génération sous app/bootstrap (casse selon le répertoire existant).\n  - Avec -p/--plugin, génération sous plugin/<plugin>/app/bootstrap.\n  - Avec -P/--path, génération dans le répertoire relatif indiqué (par rapport à la racine).\n  - L'argument positionnel enable contrôle l'ajout à config/bootstrap.php (activé par défaut ; no/false/0/off pour désactiver).\n  - Si le fichier existe, demande avant d'écraser ; -f/--force pour écraser directement.",
            'de' => "Eine Bootstrap-Klasse erzeugen (implementiert Webman\\Bootstrap).\n\nEmpfohlen:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nHinweise:\n  - Standard: Erzeugung unter app/bootstrap (Groß-/Kleinschreibung nach vorhandenem Verzeichnis).\n  - Mit -p/--plugin: unter plugin/<plugin>/app/bootstrap.\n  - Mit -P/--path: unter angegebenem relativem Pfad (zur Projektwurzel).\n  - Positionsargument enable steuert Eintrag in config/bootstrap.php (Standard: an; no/false/0/off zum Deaktivieren).\n  - Bei vorhandener Datei wird gefragt; -f/--force überschreibt direkt.",
            'es' => "Generar una clase Bootstrap (implementa Webman\\Bootstrap).\n\nRecomendado:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nNotas:\n  - Por defecto se genera en app/bootstrap (mayúsculas según el directorio existente).\n  - Con -p/--plugin se genera en plugin/<plugin>/app/bootstrap.\n  - Con -P/--path se genera en el directorio relativo indicado (respecto a la raíz).\n  - El argumento posicional enable controla si se escribe en config/bootstrap.php (activado por defecto; no/false/0/off para desactivar).\n  - Si el archivo existe, pregunta antes de sobrescribir; -f/--force sobrescribe directamente.",
            'pt_BR' => "Gerar uma classe Bootstrap (implementa Webman\\Bootstrap).\n\nRecomendado:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nNotas:\n  - Por padrão gera em app/bootstrap (maiúsculas conforme o diretório existente).\n  - Com -p/--plugin gera em plugin/<plugin>/app/bootstrap.\n  - Com -P/--path gera no diretório relativo indicado (em relação à raiz do projeto).\n  - O argumento posicional enable controla se grava em config/bootstrap.php (ativado por padrão; no/false/0/off para desativar).\n  - Se o arquivo existir, pergunta antes de sobrescrever; -f/--force sobrescreve diretamente.",
            'ru' => "Создать класс Bootstrap (реализует Webman\\Bootstrap).\n\nРекомендуется:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nПримечания:\n  - По умолчанию создаётся в app/bootstrap (регистр по существующей директории).\n  - С -p/--plugin создаётся в plugin/<plugin>/app/bootstrap.\n  - С -P/--path создаётся в указанной относительной директории (от корня проекта).\n  - Позиционный аргумент enable управляет записью в config/bootstrap.php (по умолчанию включено; no/false/0/off для отключения).\n  - Если файл существует, запрашивается подтверждение перезаписи; -f/--force перезаписывает сразу.",
            'vi' => "Tạo lớp Bootstrap (triển khai Webman\\Bootstrap).\n\nKhuyến nghị:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nLưu ý:\n  - Mặc định tạo trong app/bootstrap (chữ hoa/thường theo thư mục hiện có).\n  - Với -p/--plugin tạo trong plugin/<plugin>/app/bootstrap.\n  - Với -P/--path tạo trong thư mục tương đối chỉ định (so với thư mục gốc dự án).\n  - Tham số vị trí enable điều khiển ghi vào config/bootstrap.php (mặc định bật; no/false/0/off để tắt).\n  - Nếu tệp đã tồn tại sẽ hỏi trước khi ghi đè; -f/--force ghi đè trực tiếp.",
            'tr' => "Bootstrap sınıfı oluştur (Webman\\Bootstrap uygular).\n\nÖnerilen:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nNotlar:\n  - Varsayılan olarak app/bootstrap altında oluşturulur (büyük/küçük harf mevcut dizine göre).\n  - -p/--plugin ile plugin/<plugin>/app/bootstrap altında oluşturulur.\n  - -P/--path ile belirtilen göreli dizinde oluşturulur (proje köküne göre).\n  - Konum argümanı enable, config/bootstrap.php'ye yazılmasını kontrol eder (varsayılan açık; no/false/0/off ile devre dışı bırakılır).\n  - Dosya varsa üzerine yazmadan önce sorar; -f/--force doğrudan üzerine yazar.",
            'id' => "Buat kelas Bootstrap (mengimplementasikan Webman\\Bootstrap).\n\nDirekomendasikan:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nCatatan:\n  - Secara default dibuat di app/bootstrap (huruf mengikuti direktori yang ada).\n  - Dengan -p/--plugin dibuat di plugin/<plugin>/app/bootstrap.\n  - Dengan -P/--path dibuat di direktori relatif yang ditentukan (terhadap akar proyek).\n  - Argumen posisi enable mengontrol penulisan ke config/bootstrap.php (default aktif; no/false/0/off untuk nonaktif).\n  - Jika file sudah ada akan ditanya sebelum menimpa; -f/--force menimpa langsung.",
            'th' => "สร้างคลาส Bootstrap (ใช้ Webman\\Bootstrap).\n\nแนะนำ:\n  php webman make:bootstrap MyBootstrap\n  php webman make:bootstrap MyBootstrap no\n  php webman make:bootstrap MyBootstrap -p admin\n  php webman make:bootstrap MyBootstrap -P plugin/admin/app/bootstrap\n  php webman make:bootstrap MyBootstrap -f\n\nหมายเหตุ:\n  - ค่าเริ่มต้นสร้างใต้ app/bootstrap (ตัวพิมพ์ตามไดเรกทอรีที่มีอยู่)\n  - ใช้ -p/--plugin สร้างใต้ plugin/<plugin>/app/bootstrap\n  - ใช้ -P/--path สร้างในไดเรกทอรีสัมพัทธ์ที่ระบุ (เทียบกับรากโปรเจกต์)\n  - อาร์กิวเมนต์ enable ควบคุมการเขียน config/bootstrap.php (ค่าเริ่มต้นเปิด; no/false/0/off เพื่อปิด)\n  - ถ้ามีไฟล์อยู่แล้วจะถามก่อนเขียนทับ ใช้ -f/--force เพื่อเขียนทับโดยตรง",
        ];
    }

    public static function getMakeProcessMessages(): array
    {
        $zh = [
            'make_process' => "<info>创建进程</info> <comment>{class}</comment>\n<info>配置 key：</info> <comment>{key}</comment>\n<info>配置文件：</info> <comment>{config}</comment>",
            'invalid_plugin' => '<error>插件名无效：</error> <comment>{plugin}</comment> <error>。`--plugin/-p` 只能是 plugin/ 目录下的目录名，不能包含 / 或 \\。</error>',
            'invalid_path' => '<error>路径无效：</error> <comment>{path}</comment> <error>。`--path/-P` 必须是相对路径（相对于项目根目录），不能是绝对路径。</error>',
            'invalid_config' => '<error>无法读取配置文件（必须 return 数组）：{path}</error>',
            'config_key_exists' => "<error>进程配置已存在：</error> <comment>{key}</comment>\n<info>handler：</info> <comment>{handler}</comment>\n<info>文件：</info> <comment>{path}</comment>",
            'ask_process_name' => "<question>输入进程名</question>（回车默认 {default}）\n> ",
            'err_invalid_process_name' => '进程名无效，请使用字母/数字/下划线组合。',
            'err_process_name_exists' => '进程名已存在：{key}，请重新输入。',
            'ask_listen' => "<question>是否监听端口？</question> [y/N]（回车默认 N）\n",
            'ask_listen_mode' => "<question>请选择监听方式</question>（回车默认 N）\n  [N] 不监听（仅创建进程类）\n  [1] 监听端口（IP:Port）\n  [2] 监听 unixsocket\n> ",
            'err_invalid_listen_mode' => '监听方式无效，请输入 N/1/2。',
            'warn_port_conflict' => "<fg=yellow>警告</> 端口 <comment>{port}</comment> 已在以下配置中使用（key 冲突）：\n{items}",
            'ask_port_conflict_continue' => "<question>仍然使用该端口？</question> [y/N]（回车默认 N）\n",
            'ask_protocol' => "<question>请选择协议</question>（回车默认 1，可输入数字或协议名）\n  [1] websocket\n  [2] http\n  [3] tcp\n  [4] udp\n> ",
            'ask_http_mode' => "<question>HTTP 进程类型</question>（回车默认 1）\n  [1] 新增 webman 内置 http 进程（复用 app\\process\\Http，不创建新文件）\n  [2] 自定义 http 进程（生成进程类文件）\n> ",
            'ask_ip' => "<question>请选择监听地址</question>（回车默认 1，可输入数字或手动输入 IP）",
            'ask_ip_options' => "{options}\n> ",
            'ip_any_suffix' => '（本机内网外网都可连）',
            'ip_loopback_suffix' => '（仅本机可连）',
            'ip_lan_suffix' => '（仅内网可连）',
            'ip_wan_suffix' => '（仅外网可连）',
            'ip_manual_hint' => '也可直接输入 IP',
            'ask_port' => "<question>请输入端口</question>\n> ",
            'ask_unixsocket' => "<question>请输入 unixsocket 相对路径</question>（回车默认 {default}）\n> ",
            'ask_count' => "<question>进程数</question>（回车默认 {default}）\n> ",
            'used_default_count' => '<comment>[Info]</comment> 已使用默认进程数：{value}',
            'process_file_exists' => "<error>进程文件已存在：</error> <comment>{path}</comment>",
            'override_prompt' => "<question>文件已存在：</question> <comment>{path}</comment>\n<question>是否覆盖？[Y/n]（回车默认 Y）</question>\n",
            'created' => '<info>已创建：</info> <comment>{path}</comment>',
            'reuse_builtin_http' => '<comment>[Info]</comment> 已选择复用内置 HTTP 进程：{handler}',
            'updated_config' => '<info>已写入配置：</info> <comment>{path}</comment>  <comment>({key})</comment>',
            'write_config_failed' => '<error>写入配置失败：</error> <comment>{path}</comment>',
            'err_invalid_protocol' => '协议无效，请输入 1-4 或协议名（websocket/http/tcp/udp）',
            'err_invalid_http_mode' => '选项无效，请输入 1 或 2（builtin/custom）',
            'err_invalid_ip' => 'IP 无效，请重新输入',
            'err_invalid_port' => '端口无效，请输入 1-65535 的整数',
            'err_invalid_port_range' => '端口范围必须在 1-65535',
            'err_invalid_unixsocket_path' => '路径无效，请输入相对路径，例如 foo.sock 或 dir/foo.sock',
            'err_invalid_count_int' => '进程数必须是整数',
            'err_invalid_count_min' => '进程数必须 >= 1',
            'arg_name' => '进程类名，例如 MyProcess',
            'opt_plugin' => '插件名称（plugin/ 下的目录名，例如 admin）',
            'opt_path' => '目标目录（相对于项目根目录，例如 plugin/admin/app/process）',
            'opt_force' => '强制覆盖',
        ];

        $en = [
            'make_process' => "<info>Make process</info> <comment>{class}</comment>\n<info>Config key:</info> <comment>{key}</comment>\n<info>Config file:</info> <comment>{config}</comment>",
            'invalid_plugin' => '<error>Invalid plugin name: {plugin}. `--plugin/-p` must be a directory name under plugin/ and must not contain / or \\.</error>',
            'invalid_path' => '<error>Invalid path: </error> <comment>{path}</comment> <error>. `--path/-P` must be a relative path (to project root) and must not be an absolute path.</error>',
            'invalid_config' => '<error>Unable to read config file (must return an array): {path}</error>',
            'config_key_exists' => "<error>Process config already exists:</error> <comment>{key}</comment>\n<info>handler:</info> <comment>{handler}</comment>\n<info>file:</info> <comment>{path}</comment>",
            'ask_process_name' => "<question>Enter process name</question> (Enter default: {default})\n> ",
            'err_invalid_process_name' => 'Invalid process name. Use only letters/numbers/underscore.',
            'err_process_name_exists' => 'Process name already exists: {key}. Please enter another one.',
            'ask_listen' => "<question>Listen on a port?</question> [y/N] (Enter default: N)\n",
            'ask_listen_mode' => "<question>Select listen mode</question> (Enter default: N)\n  [N] No listen (only create class)\n  [1] Listen on IP:Port\n  [2] Listen on unixsocket\n> ",
            'err_invalid_listen_mode' => 'Invalid listen mode, please input N/1/2.',
            'warn_port_conflict' => "<fg=yellow>Warning</> Port <comment>{port}</comment> is already used (key conflict):\n{items}",
            'ask_port_conflict_continue' => "<question>Use this port anyway?</question> [y/N] (Enter default: N)\n",
            'ask_protocol' => "<question>Select protocol</question> (Enter default: 1, number or name)\n  [1] websocket\n  [2] http\n  [3] tcp\n  [4] udp\n> ",
            'ask_http_mode' => "<question>HTTP process type</question> (Enter default: 1)\n  [1] Add built-in webman HTTP process (reuse app\\process\\Http, no new file)\n  [2] Custom HTTP process (generate a new process class file)\n> ",
            'ask_ip' => "<question>Select listen address</question> (Enter default: 1, number or enter IP manually)",
            'ask_ip_options' => "{options}\n> ",
            'ip_any_suffix' => ' (LAN/WAN reachable)',
            'ip_loopback_suffix' => ' (localhost only)',
            'ip_lan_suffix' => ' (LAN only)',
            'ip_wan_suffix' => ' (WAN only)',
            'ip_manual_hint' => 'Or type an IP directly',
            'ask_port' => "<question>Enter port</question>\n> ",
            'ask_unixsocket' => "<question>Enter unixsocket relative path</question> (Enter default: {default})\n> ",
            'ask_count' => "<question>Process count</question> (Enter default: {default})\n> ",
            'used_default_count' => '<comment>[Info]</comment> Using default process count: {value}',
            'process_file_exists' => "<error>Process file already exists:</error> <comment>{path}</comment>",
            'override_prompt' => "<question>File already exists: </question> <comment>{path}</comment>\n<question>Override? [Y/n] (Enter default: Y)</question>\n",
            'created' => '<info>Created:</info> <comment>{path}</comment>',
            'reuse_builtin_http' => '<comment>[Info]</comment> Using built-in HTTP process: {handler}',
            'updated_config' => '<info>Config updated:</info> <comment>{path}</comment>  <comment>({key})</comment>',
            'write_config_failed' => '<error>Failed to write config:</error> <comment>{path}</comment>',
            'err_invalid_protocol' => 'Invalid protocol. Please enter 1-4 or a protocol name (websocket/http/tcp/udp).',
            'err_invalid_http_mode' => 'Invalid option. Please enter 1 or 2 (builtin/custom).',
            'err_invalid_ip' => 'Invalid IP address.',
            'err_invalid_port' => 'Invalid port. Please enter an integer between 1 and 65535.',
            'err_invalid_port_range' => 'Port must be between 1 and 65535.',
            'err_invalid_unixsocket_path' => 'Invalid path. Please input a relative path, e.g. foo.sock or dir/foo.sock.',
            'err_invalid_count_int' => 'Process count must be an integer.',
            'err_invalid_count_min' => 'Process count must be >= 1.',
            'arg_name' => 'Process class name, e.g. MyProcess',
            'opt_plugin' => 'Plugin name under plugin/. e.g. admin',
            'opt_path' => 'Target directory (relative to project root). e.g. plugin/admin/app/process',
            'opt_force' => 'Override existing file without confirmation.',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => $zh, 'en' => $en, 'ja' => $en, 'ko' => $en, 'fr' => $en,
            'de' => $en, 'es' => $en, 'pt_BR' => $en, 'ru' => $en, 'vi' => $en, 'tr' => $en,
            'id' => $en, 'th' => $en,
        ];
    }

    public static function getMakeProcessHelpText(): array
    {
        $zh = <<<'EOF'
交互式创建自定义进程，并自动写入对应的 process 配置。

推荐用法：
  php webman make:process MyProcess
  php webman make:process MyProcess -p admin
  php webman make:process MyProcess -P plugin/admin/app/process
  php webman make:process MyProcess -f

说明：
  - 会先把进程名转换为 snake 作为配置 key，例如 MyTcp => my_tcp。
  - 若配置 key 已存在，会给出一个可用的默认进程名（在原 key 后追加数字后缀，例如 foo1/foo2...），并在写入配置前让你确认/修改进程名。
  - 若需要生成进程类文件且文件已存在，会提示是否覆盖；使用 -f/--force 可直接覆盖。
  - 未指定 -p 时，如果 -P 指向 plugin/<name>/...，会自动推断写入 plugin/<name>/config/process.php。
EOF;
        $zhTW = <<<'EOF'
互動式建立自訂行程，並自動寫入對應的 process 設定。

推薦用法：
  php webman make:process MyProcess
  php webman make:process MyProcess -p admin
  php webman make:process MyProcess -P plugin/admin/app/process
  php webman make:process MyProcess -f

說明：
  - 會先把行程名稱轉換為 snake 作為設定 key，例如 MyTcp => my_tcp。
  - 若設定 key 已存在，會提供可用的預設行程名（在原 key 後追加數字後綴，例如 foo1/foo2...），並在寫入設定前讓你確認/修改行程名。
  - 若需產生行程類別檔案且檔案已存在，會詢問是否覆蓋；使用 -f/--force 可直接覆蓋。
  - 未指定 -p 時，若 -P 指向 plugin/<name>/...，會自動推斷並寫入 plugin/<name>/config/process.php。
EOF;
        $en = <<<'EOF'
Interactively create a custom process and append it to the process config.

Recommended:
  php webman make:process MyProcess
  php webman make:process MyProcess -p admin
  php webman make:process MyProcess -P plugin/admin/app/process
  php webman make:process MyProcess -f

Notes:
  - The process name will be converted to snake_case as config key, e.g. MyTcp => my_tcp.
  - If the config key already exists, it will suggest an available default name by appending a numeric suffix (e.g. foo1/foo2...) and ask you to confirm/change it before writing the config.
  - If a process class file already exists, it will ask before overriding; use -f/--force to override directly.
  - If -p is not provided but -P points to plugin/<name>/..., it will infer the plugin name and write to plugin/<name>/config/process.php.
EOF;

        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "対話形式でカスタムプロセスを作成し、process 設定に追記。\n\n推奨：\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\n説明：\n  - プロセス名は snake_case に変換されて config key になります（例 MyTcp => my_tcp）。\n  - config key が既に存在する場合は既存 handler を表示して終了。\n  - プロセスクラスファイルが既にある場合は上書き確認；-f/--force で直接上書き。\n  - -p を指定せず -P が plugin/<name>/... の場合はプラグイン名を推定し plugin/<name>/config/process.php に書き込み。",
            'ko' => "대화형으로 커스텀 프로세스를 만들고 process 설정에 추가.\n\n권장:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\n참고:\n  - 프로세스 이름은 snake_case로 변환되어 config key가 됩니다(예: MyTcp => my_tcp).\n  - config key가 이미 있으면 기존 handler를 출력하고 종료.\n  - 프로세스 클래스 파일이 있으면 덮어쓸지 묻고, -f/--force로 직접 덮어쓰기.\n  - -p 없이 -P가 plugin/<name>/... 이면 플러그인 이름을 추론해 plugin/<name>/config/process.php에 기록.",
            'fr' => "Créer interactivement un processus personnalisé et l'ajouter à la config process.\n\nRecommandé :\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nRemarques :\n  - Le nom du processus est converti en snake_case comme clé de config (ex. MyTcp => my_tcp).\n  - Si la clé existe déjà, affiche le handler existant et quitte.\n  - Si le fichier de classe du processus existe déjà, demande confirmation avant d'écraser ; -f/--force pour écraser directement.\n  - Sans -p, si -P pointe vers plugin/<name>/..., infère le nom du plugin et écrit dans plugin/<name>/config/process.php.",
            'de' => "Interaktiv einen benutzerdefinierten Prozess anlegen und in die process-Config eintragen.\n\nEmpfohlen:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nHinweise:\n  - Prozessname wird als Config-Key in snake_case umgewandelt (z. B. MyTcp => my_tcp).\n  - Wenn der Key bereits existiert, wird der bestehende Handler ausgegeben und die Ausführung beendet.\n  - Bei existierender Prozessklassendatei wird vor Überschreiben gefragt; -f/--force überschreibt direkt.\n  - Ohne -p, wenn -P auf plugin/<name>/... zeigt, wird der Plugin-Name erkannt und plugin/<name>/config/process.php geschrieben.",
            'es' => "Crear de forma interactiva un proceso personalizado y añadirlo a la config process.\n\nRecomendado:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nNotas:\n  - El nombre del proceso se convierte a snake_case como clave de config (ej. MyTcp => my_tcp).\n  - Si la clave ya existe, muestra el handler existente y sale.\n  - Si el archivo de clase ya existe, pregunta antes de sobrescribir; -f/--force sobrescribe directamente.\n  - Sin -p, si -P apunta a plugin/<name>/..., infiere el plugin y escribe en plugin/<name>/config/process.php.",
            'pt_BR' => "Criar interativamente um processo personalizado e adicionar à config process.\n\nRecomendado:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nNotas:\n  - O nome do processo é convertido para snake_case como chave de config (ex. MyTcp => my_tcp).\n  - Se a chave já existir, imprime o handler existente e sai.\n  - Se o arquivo da classe já existir, pergunta antes de sobrescrever; -f/--force sobrescreve diretamente.\n  - Sem -p, se -P apontar para plugin/<name>/..., infere o plugin e grava em plugin/<name>/config/process.php.",
            'ru' => "Интерактивно создать пользовательский процесс и добавить в config process.\n\nРекомендуется:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nПримечания:\n  - Имя процесса преобразуется в snake_case как ключ config (напр. MyTcp => my_tcp).\n  - Если ключ уже существует, выводится существующий handler, после чего программа завершает работу.\n  - Если файл класса уже есть, запрашивается подтверждение перезаписи; -f/--force перезаписывает сразу.\n  - Без -p при -P вида plugin/<name>/... определяется имя плагина и выполняется запись в plugin/<name>/config/process.php.",
            'vi' => "Tạo process tùy chỉnh một cách tương tác và ghi vào config process.\n\nKhuyến nghị:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nLưu ý:\n  - Tên process được chuyển thành snake_case làm config key (vd. MyTcp => my_tcp).\n  - Nếu config key đã tồn tại sẽ in handler hiện có rồi thoát.\n  - Nếu file lớp process đã có sẽ hỏi trước khi ghi đè; -f/--force ghi đè trực tiếp.\n  - Không dùng -p mà -P trỏ tới plugin/<name>/... thì suy ra tên plugin và ghi vào plugin/<name>/config/process.php.",
            'tr' => "Etkileşimli özel proses oluştur ve process config'e ekle.\n\nÖnerilen:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nNotlar:\n  - Proses adı config key olarak snake_case'e dönüştürülür (örn. MyTcp => my_tcp).\n  - Key zaten varsa mevcut handler yazdırılır ve çıkılır.\n  - Proses sınıf dosyası varsa üzerine yazmadan önce sorar; -f/--force doğrudan üzerine yazar.\n  - -p verilmez ve -P plugin/<name>/... ise plugin adı çıkarılıp plugin/<name>/config/process.php'ye yazılır.",
            'id' => "Buat proses kustom secara interaktif dan tambahkan ke config process.\n\nDirekomendasikan:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nCatatan:\n  - Nama proses dikonversi ke snake_case sebagai config key (mis. MyTcp => my_tcp).\n  - Jika key sudah ada, cetak handler yang ada dan keluar.\n  - Jika file kelas proses sudah ada akan ditanya sebelum menimpa; -f/--force menimpa langsung.\n  - Tanpa -p, jika -P mengarah ke plugin/<name>/..., infer nama plugin dan tulis ke plugin/<name>/config/process.php.",
            'th' => "สร้าง process ที่กำหนดเองแบบโต้ตอบและเขียนลง config process\n\nแนะนำ:\n  php webman make:process MyProcess\n  php webman make:process MyProcess -p admin\n  php webman make:process MyProcess -P plugin/admin/app/process\n  php webman make:process MyProcess -f\n\nหมายเหตุ:\n  - ชื่อ process จะถูกแปลงเป็น snake_case เป็น config key (เช่น MyTcp => my_tcp)\n  - ถ้า config key มีอยู่แล้วจะแสดง handler ที่มีและออก\n  - ถ้ามีไฟล์คลาสอยู่แล้วจะถามก่อนเขียนทับ -f/--force เขียนทับโดยตรง\n  - ถ้าไม่ใส่ -p แต่ -P ชี้ไป plugin/<name>/... จะอนุมานชื่อปลั๊กอินและเขียนไปที่ plugin/<name>/config/process.php",
        ];
    }

    public static function getBuildMessages(): array
    {
        $zh = [
            'collect_complete' => '<info>文件收集完成</info> <comment>开始写入 Phar...</comment>',
            'write_to_disk' => '<info>写入 Phar 归档</info> <comment>并保存到磁盘...</comment>',
            'phar_packing' => '<comment>Phar 打包中...</comment>',
            'downloading_php' => "\r\n<comment>正在下载 PHP{version} ...</comment>",
            'download_failed' => '<error>下载失败：</error> {message}',
            'use_php' => "\r\n<comment>使用本地 PHP{version} 资源...</comment>",
            'saved_bin' => "\r\n<info>已保存</info> {name} <comment>→</comment> {path}\r\n<info>构建成功</info>\r\n",
            'download_stream_failed' => '<error>下载失败：</error> 无法连接下载源',
            'mkdir_build_dir_failed' => '创建 Phar 输出目录失败，请检查权限。',
            'bad_signature_algorithm' => '签名算法必须是 Phar::MD5、Phar::SHA1、Phar::SHA256、Phar::SHA512 或 Phar::OPENSSL 之一。',
            'openssl_private_key_missing' => "当签名算法为 'Phar::OPENSSL' 时，必须配置 private key 文件。",
            'phar_extension_required' => "打包 Phar 需要启用 'phar' 扩展。",
            'phar_readonly_on' => "{ini} 中 'phar.readonly' 为 On，打包 Phar 需要将其关闭（设置为 Off）才能打包，也可使用如下命令打包：php -d phar.readonly=0 ./webman {command}",
            'phar_filename_required' => '请配置 phar 文件名（phar_filename）。',
            'ini_not_loaded' => 'php.ini（未加载）',
            'arg_version' => 'PHP 版本',
        ];

        $en = [
            'collect_complete' => '<info>Files collected</info> <comment>begin writing Phar...</comment>',
            'write_to_disk' => '<info>Writing Phar archive</info> <comment>and saving to disk...</comment>',
            'phar_packing' => '<comment>Phar packing...</comment>',
            'downloading_php' => "\r\n<comment>Downloading PHP{version} ...</comment>",
            'download_failed' => '<error>Download failed:</error> {message}',
            'use_php' => "\r\n<comment>Using local PHP{version} assets...</comment>",
            'saved_bin' => "\r\n<info>Saved</info> {name} <comment>to</comment> {path}\r\n<info>Build Success!</info>\r\n",
            'download_stream_failed' => '<error>Download failed:</error> cannot connect to download source',
            'mkdir_build_dir_failed' => 'Failed to create Phar output directory. Please check permissions.',
            'bad_signature_algorithm' => 'Signature algorithm must be one of Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512, or Phar::OPENSSL.',
            'openssl_private_key_missing' => "When signature algorithm is 'Phar::OPENSSL', you must configure the private key file.",
            'phar_extension_required' => "The 'phar' extension is required to build a Phar package.",
            'phar_readonly_on' => "In {ini}, 'phar.readonly' is On. Set it to Off to build Phar, or run: php -d phar.readonly=0 ./webman {command}",
            'phar_filename_required' => 'Please set the Phar filename (phar_filename).',
            'ini_not_loaded' => 'php.ini (not loaded)',
            'arg_version' => 'PHP version',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => array_merge($zh, [
                'collect_complete' => '<info>檔案收集完成</info> <comment>開始寫入 Phar...</comment>',
                'write_to_disk' => '<info>寫入 Phar 歸檔</info> <comment>並儲存到磁碟...</comment>',
                'downloading_php' => "\r\n<comment>正在下載 PHP{version} ...</comment>",
                'download_failed' => '<error>下載失敗：</error> {message}',
                'use_php' => '使用本地 PHP {version} 緩存',
                'saved_bin' => '構建完成！二進制文件 {name} 已保存至: {path}',
                'download_stream_failed' => '<error>下載失敗：</error> 無法連線至下載來源',
                'mkdir_build_dir_failed' => '建立 Phar 輸出目錄失敗，請檢查權限。',
                'bad_signature_algorithm' => '簽章演算法必須為 Phar::MD5、Phar::SHA1、Phar::SHA256、Phar::SHA512 或 Phar::OPENSSL 之一。',
                'openssl_private_key_missing' => "當簽章演算法為 'Phar::OPENSSL' 時，必須設定 private key 檔案。",
                'phar_extension_required' => "打包 Phar 需啟用 'phar' 擴充功能。",
                'phar_readonly_on' => "{ini} 中 'phar.readonly' 為 On，打包 Phar 需將其關閉（設為 Off），或執行：php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => '請設定 phar 檔名（phar_filename）。',
                'ini_not_loaded' => 'php.ini（未載入）',
            ]),
            'en' => array_merge($en, [
                'saved_bin' => 'Build complete! Binary file {name} saved to: {path}',
            ]),
            'ja' => array_merge($en, [
                'collect_complete' => '<info>ファイル収集完了</info> <comment>Phar 書き込み開始...</comment>',
                'write_to_disk' => '<info>Phar アーカイブを書き込み</info> <comment>ディスクに保存中...</comment>',
                'phar_packing' => '<comment>Phar パッキング中...</comment>',
                'downloading_php' => "\r\n<comment>PHP{version} をダウンロード中...</comment>",
                'download_failed' => '<error>ダウンロード失敗：</error> {message}',
                'use_php' => "\r\n<comment>ローカル PHP{version} を使用...</comment>",
                'saved_bin' => "\r\n<info>保存しました</info> {name} <comment>→</comment> {path}\r\n<info>ビルド成功</info>\r\n",
                'download_stream_failed' => '<error>ダウンロード失敗：</error> ダウンロード元に接続できません',
                'mkdir_build_dir_failed' => 'Phar 出力ディレクトリの作成に失敗しました。権限を確認してください。',
                'bad_signature_algorithm' => '署名アルゴリズムは Phar::MD5、Phar::SHA1、Phar::SHA256、Phar::SHA512、Phar::OPENSSL のいずれかである必要があります。',
                'openssl_private_key_missing' => "署名アルゴリズムが 'Phar::OPENSSL' の場合は、秘密鍵ファイルの設定が必要です。",
                'phar_extension_required' => "Phar のビルドには 'phar' 拡張が必要です。",
                'phar_readonly_on' => "{ini} で 'phar.readonly' が On です。Phar をビルドするには Off に設定するか、実行: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Phar ファイル名（phar_filename）を設定してください。',
                'ini_not_loaded' => 'php.ini（未読み込み）',
            ]),
            'ko' => array_merge($en, [
                'collect_complete' => '<info>파일 수집 완료</info> <comment>Phar 쓰기 시작...</comment>',
                'write_to_disk' => '<info>Phar 아카이브 쓰기</info> <comment>디스크에 저장 중...</comment>',
                'phar_packing' => '<comment>Phar 패킹 중...</comment>',
                'downloading_php' => "\r\n<comment>PHP{version} 다운로드 중...</comment>",
                'download_failed' => '<error>다운로드 실패:</error> {message}',
                'use_php' => "\r\n<comment>로컬 PHP{version} 사용 중...</comment>",
                'saved_bin' => "\r\n<info>저장됨</info> {name} <comment>→</comment> {path}\r\n<info>빌드 성공</info>\r\n",
                'download_stream_failed' => '<error>다운로드 실패:</error> 다운로드 소스에 연결할 수 없습니다',
                'mkdir_build_dir_failed' => 'Phar 출력 디렉터리 생성에 실패했습니다. 권한을 확인하세요.',
                'bad_signature_algorithm' => '서명 알고리즘은 Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512, Phar::OPENSSL 중 하나여야 합니다.',
                'openssl_private_key_missing' => "서명 알고리즘이 'Phar::OPENSSL'일 경우 private key 파일을 설정해야 합니다.",
                'phar_extension_required' => "Phar 패키지 빌드에는 'phar' 확장이 필요합니다.",
                'phar_readonly_on' => "{ini}에서 'phar.readonly'가 On입니다. Phar 빌드를 위해 Off로 설정하거나 실행: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Phar 파일명(phar_filename)을 설정하세요.',
                'ini_not_loaded' => 'php.ini(로드되지 않음)',
            ]),
            'fr' => array_merge($en, [
                'collect_complete' => '<info>Fichiers collectés</info> <comment>écriture du Phar...</comment>',
                'write_to_disk' => '<info>Écriture de l\'archive Phar</info> <comment>et enregistrement...</comment>',
                'phar_packing' => '<comment>Création du Phar...</comment>',
                'downloading_php' => "\r\n<comment>Téléchargement de PHP{version}...</comment>",
                'download_failed' => '<error>Échec du téléchargement :</error> {message}',
                'use_php' => "\r\n<comment>Utilisation du PHP{version} local...</comment>",
                'saved_bin' => "\r\n<info>Enregistré</info> {name} <comment>→</comment> {path}\r\n<info>Build réussi</info>\r\n",
                'download_stream_failed' => '<error>Échec du téléchargement :</error> impossible de contacter la source',
                'mkdir_build_dir_failed' => 'Échec de la création du répertoire de sortie Phar. Vérifiez les permissions.',
                'bad_signature_algorithm' => 'L\'algorithme de signature doit être Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 ou Phar::OPENSSL.',
                'openssl_private_key_missing' => "Quand l'algorithme est 'Phar::OPENSSL', vous devez configurer le fichier de clé privée.",
                'phar_extension_required' => "L'extension 'phar' est requise pour créer un Phar.",
                'phar_readonly_on' => "Dans {ini}, 'phar.readonly' est On. Passez à Off pour construire le Phar, ou exécutez : php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Veuillez définir le nom du fichier Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (non chargé)',
            ]),
            'de' => array_merge($en, [
                'collect_complete' => '<info>Dateien gesammelt</info> <comment>Schreibe Phar...</comment>',
                'write_to_disk' => '<info>Phar-Archiv wird geschrieben</info> <comment>und auf Disk gespeichert...</comment>',
                'phar_packing' => '<comment>Phar wird erstellt...</comment>',
                'downloading_php' => "\r\n<comment>Lade PHP{version} herunter...</comment>",
                'download_failed' => '<error>Download fehlgeschlagen:</error> {message}',
                'use_php' => "\r\n<comment>Lokale PHP{version}-Ressourcen werden verwendet...</comment>",
                'saved_bin' => "\r\n<info>Gespeichert</info> {name} <comment>→</comment> {path}\r\n<info>Build erfolgreich</info>\r\n",
                'download_stream_failed' => '<error>Download fehlgeschlagen:</error> Verbindung zur Quelle nicht möglich',
                'mkdir_build_dir_failed' => 'Phar-Ausgabeverzeichnis konnte nicht erstellt werden. Bitte Berechtigungen prüfen.',
                'bad_signature_algorithm' => 'Signaturalgorithmus muss Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 oder Phar::OPENSSL sein.',
                'openssl_private_key_missing' => "Bei 'Phar::OPENSSL' muss die Private-Key-Datei konfiguriert werden.",
                'phar_extension_required' => "Die Extension 'phar' wird zum Erstellen eines Phar-Pakets benötigt.",
                'phar_readonly_on' => "{ini} ist 'phar.readonly' auf On. Zum Erstellen auf Off setzen oder ausführen: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Bitte den Phar-Dateinamen (phar_filename) setzen.',
                'ini_not_loaded' => 'php.ini (nicht geladen)',
            ]),
            'es' => array_merge($en, [
                'collect_complete' => '<info>Archivos recopilados</info> <comment>escribiendo Phar...</comment>',
                'write_to_disk' => '<info>Escribiendo archivo Phar</info> <comment>y guardando en disco...</comment>',
                'phar_packing' => '<comment>Empaquetando Phar...</comment>',
                'downloading_php' => "\r\n<comment>Descargando PHP{version}...</comment>",
                'download_failed' => '<error>Error de descarga:</error> {message}',
                'use_php' => "\r\n<comment>Usando PHP{version} local...</comment>",
                'saved_bin' => "\r\n<info>Guardado</info> {name} <comment>→</comment> {path}\r\n<info>Build correcto</info>\r\n",
                'download_stream_failed' => '<error>Error de descarga:</error> no se pudo conectar con la fuente',
                'mkdir_build_dir_failed' => 'No se pudo crear el directorio de salida Phar. Compruebe los permisos.',
                'bad_signature_algorithm' => 'El algoritmo de firma debe ser Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 o Phar::OPENSSL.',
                'openssl_private_key_missing' => "Cuando el algoritmo es 'Phar::OPENSSL', debe configurar el archivo de clave privada.",
                'phar_extension_required' => "Se requiere la extensión 'phar' para construir un Phar.",
                'phar_readonly_on' => "En {ini}, 'phar.readonly' está On. Ponlo en Off para construir Phar, o ejecuta: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Configure el nombre del archivo Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (no cargado)',
            ]),
            'pt_BR' => array_merge($en, [
                'collect_complete' => '<info>Arquivos coletados</info> <comment>escrevendo Phar...</comment>',
                'write_to_disk' => '<info>Gravando arquivo Phar</info> <comment>e salvando em disco...</comment>',
                'phar_packing' => '<comment>Empacotando Phar...</comment>',
                'downloading_php' => "\r\n<comment>Baixando PHP{version}...</comment>",
                'download_failed' => '<error>Falha no download:</error> {message}',
                'use_php' => "\r\n<comment>Usando PHP{version} local...</comment>",
                'saved_bin' => "\r\n<info>Salvo</info> {name} <comment>→</comment> {path}\r\n<info>Build concluído</info>\r\n",
                'download_stream_failed' => '<error>Falha no download:</error> não foi possível conectar à fonte',
                'mkdir_build_dir_failed' => 'Falha ao criar o diretório de saída do Phar. Verifique as permissões.',
                'bad_signature_algorithm' => 'O algoritmo de assinatura deve ser Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 ou Phar::OPENSSL.',
                'openssl_private_key_missing' => "Quando o algoritmo for 'Phar::OPENSSL', é necessário configurar o arquivo da chave privada.",
                'phar_extension_required' => "A extensão 'phar' é necessária para construir um Phar.",
                'phar_readonly_on' => "Em {ini}, 'phar.readonly' está On. Defina como Off para construir o Phar, ou execute: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Defina o nome do arquivo Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (não carregado)',
            ]),
            'ru' => array_merge($en, [
                'collect_complete' => '<info>Файлы собраны</info> <comment>запись Phar...</comment>',
                'write_to_disk' => '<info>Запись архива Phar</info> <comment>и сохранение на диск...</comment>',
                'phar_packing' => '<comment>Создание Phar...</comment>',
                'downloading_php' => "\r\n<comment>Загрузка PHP{version}...</comment>",
                'download_failed' => '<error>Ошибка загрузки:</error> {message}',
                'use_php' => "\r\n<comment>Используются локальные PHP{version}...</comment>",
                'saved_bin' => "\r\n<info>Сохранено</info> {name} <comment>→</comment> {path}\r\n<info>Сборка успешна</info>\r\n",
                'download_stream_failed' => '<error>Ошибка загрузки:</error> не удалось подключиться к источнику',
                'mkdir_build_dir_failed' => 'Не удалось создать каталог для Phar. Проверьте права доступа.',
                'bad_signature_algorithm' => 'Алгоритм подписи должен быть Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 или Phar::OPENSSL.',
                'openssl_private_key_missing' => "При алгоритме 'Phar::OPENSSL' необходимо настроить файл закрытого ключа.",
                'phar_extension_required' => "Для сборки Phar требуется расширение 'phar'.",
                'phar_readonly_on' => "В {ini} параметр 'phar.readonly' включён. Установите Off для сборки Phar или выполните: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Укажите имя файла Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (не загружен)',
            ]),
            'vi' => array_merge($en, [
                'collect_complete' => '<info>Đã thu thập tệp</info> <comment>đang ghi Phar...</comment>',
                'write_to_disk' => '<info>Ghi archive Phar</info> <comment>và lưu vào đĩa...</comment>',
                'phar_packing' => '<comment>Đang đóng gói Phar...</comment>',
                'downloading_php' => "\r\n<comment>Đang tải PHP{version}...</comment>",
                'download_failed' => '<error>Tải thất bại:</error> {message}',
                'use_php' => "\r\n<comment>Đang dùng PHP{version} local...</comment>",
                'saved_bin' => "\r\n<info>Đã lưu</info> {name} <comment>→</comment> {path}\r\n<info>Build thành công</info>\r\n",
                'download_stream_failed' => '<error>Tải thất bại:</error> không kết nối được nguồn tải',
                'mkdir_build_dir_failed' => 'Tạo thư mục xuất Phar thất bại. Vui lòng kiểm tra quyền.',
                'bad_signature_algorithm' => 'Thuật toán chữ ký phải là Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 hoặc Phar::OPENSSL.',
                'openssl_private_key_missing' => "Khi dùng 'Phar::OPENSSL' bạn phải cấu hình file private key.",
                'phar_extension_required' => "Cần bật extension 'phar' để build Phar.",
                'phar_readonly_on' => "Trong {ini}, 'phar.readonly' đang On. Đặt Off để build Phar, hoặc chạy: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Vui lòng cấu hình tên file Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (chưa tải)',
            ]),
            'tr' => array_merge($en, [
                'collect_complete' => '<info>Dosyalar toplandı</info> <comment>Phar yazılıyor...</comment>',
                'write_to_disk' => '<info>Phar arşivi yazılıyor</info> <comment>diske kaydediliyor...</comment>',
                'phar_packing' => '<comment>Phar paketleniyor...</comment>',
                'downloading_php' => "\r\n<comment>PHP{version} indiriliyor...</comment>",
                'download_failed' => '<error>İndirme başarısız:</error> {message}',
                'use_php' => "\r\n<comment>Yerel PHP{version} kullanılıyor...</comment>",
                'saved_bin' => "\r\n<info>Kaydedildi</info> {name} <comment>→</comment> {path}\r\n<info>Derleme başarılı</info>\r\n",
                'download_stream_failed' => '<error>İndirme başarısız:</error> kaynağa bağlanılamıyor',
                'mkdir_build_dir_failed' => 'Phar çıktı dizini oluşturulamadı. İzinleri kontrol edin.',
                'bad_signature_algorithm' => 'İmza algoritması Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 veya Phar::OPENSSL olmalıdır.',
                'openssl_private_key_missing' => "'Phar::OPENSSL' kullanıldığında private key dosyası yapılandırılmalıdır.",
                'phar_extension_required' => "Phar oluşturmak için 'phar' eklentisi gerekir.",
                'phar_readonly_on' => "{ini} içinde 'phar.readonly' Açık. Phar için Kapatın veya çalıştırın: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Phar dosya adını (phar_filename) ayarlayın.',
                'ini_not_loaded' => 'php.ini (yüklenmedi)',
            ]),
            'id' => array_merge($en, [
                'collect_complete' => '<info>File terkumpul</info> <comment>menulis Phar...</comment>',
                'write_to_disk' => '<info>Menulis arsip Phar</info> <comment>dan menyimpan ke disk...</comment>',
                'phar_packing' => '<comment>Membuat paket Phar...</comment>',
                'downloading_php' => "\r\n<comment>Mengunduh PHP{version}...</comment>",
                'download_failed' => '<error>Unduhan gagal:</error> {message}',
                'use_php' => "\r\n<comment>Menggunakan aset PHP{version} lokal...</comment>",
                'saved_bin' => "\r\n<info>Disimpan</info> {name} <comment>→</comment> {path}\r\n<info>Build berhasil</info>\r\n",
                'download_stream_failed' => '<error>Unduhan gagal:</error> tidak dapat terhubung ke sumber',
                'mkdir_build_dir_failed' => 'Gagal membuat direktori keluaran Phar. Periksa izin.',
                'bad_signature_algorithm' => 'Algoritma tanda tangan harus Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512, atau Phar::OPENSSL.',
                'openssl_private_key_missing' => "Jika algoritma 'Phar::OPENSSL', Anda harus mengonfigurasi file private key.",
                'phar_extension_required' => "Ekstensi 'phar' diperlukan untuk membuat Phar.",
                'phar_readonly_on' => "Di {ini}, 'phar.readonly' On. Setel Off untuk build Phar, atau jalankan: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'Atur nama file Phar (phar_filename).',
                'ini_not_loaded' => 'php.ini (tidak dimuat)',
            ]),
            'th' => array_merge($en, [
                'collect_complete' => '<info>รวบรวมไฟล์เสร็จแล้ว</info> <comment>กำลังเขียน Phar...</comment>',
                'write_to_disk' => '<info>กำลังเขียนไฟล์ Phar</info> <comment>และบันทึกลงดิสก์...</comment>',
                'phar_packing' => '<comment>กำลังแพ็ก Phar...</comment>',
                'downloading_php' => "\r\n<comment>กำลังดาวน์โหลด PHP{version}...</comment>",
                'download_failed' => '<error>ดาวน์โหลดล้มเหลว：</error> {message}',
                'use_php' => "\r\n<comment>ใช้ PHP{version} ท้องถิ่น...</comment>",
                'saved_bin' => "\r\n<info>บันทึกแล้ว</info> {name} <comment>→</comment> {path}\r\n<info>Build สำเร็จ</info>\r\n",
                'download_stream_failed' => '<error>ดาวน์โหลดล้มเหลว：</error> เชื่อมต่อแหล่งดาวน์โหลดไม่ได้',
                'mkdir_build_dir_failed' => 'สร้างไดเรกทอรีเอาต์พุต Phar ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์',
                'bad_signature_algorithm' => 'อัลกอริทึมลายเซ็นต้องเป็น Phar::MD5, Phar::SHA1, Phar::SHA256, Phar::SHA512 หรือ Phar::OPENSSL',
                'openssl_private_key_missing' => "เมื่อใช้อัลกอริทึม 'Phar::OPENSSL' ต้องกำหนดค่าไฟล์ private key",
                'phar_extension_required' => "ต้องเปิดใช้ extension 'phar' เพื่อ build Phar",
                'phar_readonly_on' => "ใน {ini} 'phar.readonly' เป็น On ตั้งเป็น Off เพื่อ build Phar หรือรัน: php -d phar.readonly=0 ./webman {command}",
                'phar_filename_required' => 'กรุณาตั้งค่าชื่อไฟล์ Phar (phar_filename)',
                'ini_not_loaded' => 'php.ini (ไม่ได้โหลด)',
            ]),
        ];
    }

    public static function getFixDisableFunctionsMessages(): array
    {
        $zh = [
            'no_ini' => '<error>找不到 php.ini</error>',
            'location' => '<comment>php.ini 路径</comment> {path}',
            'ok' => '<info>OK</info> <info>disable_functions 为空，无需处理</info>',
            'ini_empty' => '<error>php.ini 内容为空：</error> <comment>{path}</comment>',
            'enabled' => '<info>已启用</info> <comment>{func}</comment>',
            'success' => '<info>完成</info>',
        ];

        $en = [
            'no_ini' => '<error>Cannot find php.ini</error>',
            'location' => '<comment>php.ini</comment> {path}',
            'ok' => '<info>OK</info> <info>disable_functions is empty, nothing to fix</info>',
            'ini_empty' => '<error>php.ini content is empty:</error> <comment>{path}</comment>',
            'enabled' => '<info>Enabled</info> <comment>{func}</comment>',
            'success' => '<info>Done</info>',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => [
                'no_ini' => '<error>找不到 php.ini</error>',
                'location' => '<comment>php.ini 路徑</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions 為空，無需處理</info>',
                'ini_empty' => '<error>php.ini 內容為空：</error> <comment>{path}</comment>',
                'enabled' => '<info>已啟用</info> <comment>{func}</comment>',
                'success' => '<info>完成</info>',
            ],
            'en' => $en,
            'ja' => [
                'no_ini' => '<error>php.ini が見つかりません</error>',
                'location' => '<comment>php.ini のパス</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions は空です。修正不要です</info>',
                'ini_empty' => '<error>php.ini の内容が空です：</error> <comment>{path}</comment>',
                'enabled' => '<info>有効化しました</info> <comment>{func}</comment>',
                'success' => '<info>完了</info>',
            ],
            'ko' => [
                'no_ini' => '<error>php.ini를 찾을 수 없습니다</error>',
                'location' => '<comment>php.ini 경로</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions가 비어 있어 수정할 항목이 없습니다</info>',
                'ini_empty' => '<error>php.ini 내용이 비어 있습니다：</error> <comment>{path}</comment>',
                'enabled' => '<info>활성화됨</info> <comment>{func}</comment>',
                'success' => '<info>완료</info>',
            ],
            'fr' => [
                'no_ini' => '<error>Fichier php.ini introuvable</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions est vide, rien à modifier</info>',
                'ini_empty' => '<error>Le contenu de php.ini est vide :</error> <comment>{path}</comment>',
                'enabled' => '<info>Activé</info> <comment>{func}</comment>',
                'success' => '<info>Terminé</info>',
            ],
            'de' => [
                'no_ini' => '<error>php.ini wurde nicht gefunden</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions ist leer, nichts zu ändern</info>',
                'ini_empty' => '<error>php.ini-Inhalt ist leer:</error> <comment>{path}</comment>',
                'enabled' => '<info>Aktiviert</info> <comment>{func}</comment>',
                'success' => '<info>Fertig</info>',
            ],
            'es' => [
                'no_ini' => '<error>No se encuentra php.ini</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions está vacío, nada que corregir</info>',
                'ini_empty' => '<error>El contenido de php.ini está vacío:</error> <comment>{path}</comment>',
                'enabled' => '<info>Habilitado</info> <comment>{func}</comment>',
                'success' => '<info>Hecho</info>',
            ],
            'pt_BR' => [
                'no_ini' => '<error>Não foi possível encontrar php.ini</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions está vazio, nada a corrigir</info>',
                'ini_empty' => '<error>Conteúdo de php.ini está vazio:</error> <comment>{path}</comment>',
                'enabled' => '<info>Habilitado</info> <comment>{func}</comment>',
                'success' => '<info>Concluído</info>',
            ],
            'ru' => [
                'no_ini' => '<error>Файл php.ini не найден</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions пуст, изменений не требуется</info>',
                'ini_empty' => '<error>Содержимое php.ini пусто:</error> <comment>{path}</comment>',
                'enabled' => '<info>Включено</info> <comment>{func}</comment>',
                'success' => '<info>Готово</info>',
            ],
            'vi' => [
                'no_ini' => '<error>Không tìm thấy php.ini</error>',
                'location' => '<comment>Đường dẫn php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions trống, không cần xử lý</info>',
                'ini_empty' => '<error>Nội dung php.ini trống:</error> <comment>{path}</comment>',
                'enabled' => '<info>Đã bật</info> <comment>{func}</comment>',
                'success' => '<info>Xong</info>',
            ],
            'tr' => [
                'no_ini' => '<error>php.ini bulunamadı</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions boş, düzeltilecek bir şey yok</info>',
                'ini_empty' => '<error>php.ini içeriği boş:</error> <comment>{path}</comment>',
                'enabled' => '<info>Etkinleştirildi</info> <comment>{func}</comment>',
                'success' => '<info>Tamamlandı</info>',
            ],
            'id' => [
                'no_ini' => '<error>Tidak dapat menemukan php.ini</error>',
                'location' => '<comment>php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions kosong, tidak ada yang perlu diperbaiki</info>',
                'ini_empty' => '<error>Konten php.ini kosong:</error> <comment>{path}</comment>',
                'enabled' => '<info>Diaktifkan</info> <comment>{func}</comment>',
                'success' => '<info>Selesai</info>',
            ],
            'th' => [
                'no_ini' => '<error>ไม่พบ php.ini</error>',
                'location' => '<comment>เส้นทาง php.ini</comment> {path}',
                'ok' => '<info>OK</info> <info>disable_functions ว่าง ไม่ต้องแก้ไข</info>',
                'ini_empty' => '<error>เนื้อหา php.ini ว่าง：</error> <comment>{path}</comment>',
                'enabled' => '<info>เปิดใช้งานแล้ว</info> <comment>{func}</comment>',
                'success' => '<info>เสร็จสิ้น</info>',
            ],
        ];
    }

    public static function getInstallMessages(): array
    {
        $zh = [
            'install_title' => '<info>执行 Webman 安装脚本</info>',
            'done' => '<info>完成</info>',
            'require_version' => '<error>该命令需要 webman-framework 版本 >= 1.3.0</error>',
        ];

        $en = [
            'install_title' => '<info>Execute Webman installation script</info>',
            'done' => '<info>Done</info>',
            'require_version' => '<error>This command requires webman-framework version >= 1.3.0</error>',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => [
                'install_title' => '<info>執行 Webman 安裝腳本</info>',
                'done' => '<info>完成</info>',
                'require_version' => '<error>此命令需要 webman-framework 版本 >= 1.3.0</error>',
            ],
            'en' => $en,
            'ja' => [
                'install_title' => '<info>Webman インストールスクリプトを実行</info>',
                'done' => '<info>完了</info>',
                'require_version' => '<error>このコマンドには webman-framework 1.3.0 以上が必要です</error>',
            ],
            'ko' => [
                'install_title' => '<info>Webman 설치 스크립트 실행</info>',
                'done' => '<info>완료</info>',
                'require_version' => '<error>이 명령은 webman-framework 1.3.0 이상이 필요합니다</error>',
            ],
            'fr' => [
                'install_title' => '<info>Exécuter le script d\'installation de Webman</info>',
                'done' => '<info>Terminé</info>',
                'require_version' => '<error>Cette commande requiert webman-framework >= 1.3.0</error>',
            ],
            'de' => [
                'install_title' => '<info>Webman-Installationsskript ausführen</info>',
                'done' => '<info>Fertig</info>',
                'require_version' => '<error>Dieser Befehl erfordert webman-framework >= 1.3.0</error>',
            ],
            'es' => [
                'install_title' => '<info>Ejecutar script de instalación de Webman</info>',
                'done' => '<info>Hecho</info>',
                'require_version' => '<error>Este comando requiere webman-framework >= 1.3.0</error>',
            ],
            'pt_BR' => [
                'install_title' => '<info>Executar script de instalação do Webman</info>',
                'done' => '<info>Concluído</info>',
                'require_version' => '<error>Este comando requer webman-framework >= 1.3.0</error>',
            ],
            'ru' => [
                'install_title' => '<info>Выполнить скрипт установки Webman</info>',
                'done' => '<info>Готово</info>',
                'require_version' => '<error>Для этой команды требуется webman-framework >= 1.3.0</error>',
            ],
            'vi' => [
                'install_title' => '<info>Chạy script cài đặt Webman</info>',
                'done' => '<info>Xong</info>',
                'require_version' => '<error>Lệnh này yêu cầu webman-framework >= 1.3.0</error>',
            ],
            'tr' => [
                'install_title' => '<info>Webman kurulum betiğini çalıştır</info>',
                'done' => '<info>Tamamlandı</info>',
                'require_version' => '<error>Bu komut webman-framework 1.3.0 veya üstü gerektirir</error>',
            ],
            'id' => [
                'install_title' => '<info>Jalankan skrip instalasi Webman</info>',
                'done' => '<info>Selesai</info>',
                'require_version' => '<error>Perintah ini memerlukan webman-framework >= 1.3.0</error>',
            ],
            'th' => [
                'install_title' => '<info>รันสคริปต์ติดตั้ง Webman</info>',
                'done' => '<info>เสร็จสิ้น</info>',
                'require_version' => '<error>คำสั่งนี้ต้องใช้ webman-framework >= 1.3.0</error>',
            ],
        ];
    }

    public static function getRouteListMessages(): array
    {
        $zh = [
            'title' => '<info>路由列表</info>',
            'headers' => ['URI', '方法', '回调', '中间件', '名称'],
            'closure_label' => '闭包',
            'desc' => '路由列表',
        ];

        $tw = [
            'title' => '<info>路由列表</info>',
            'headers' => ['URI', '方法', '回調', '中間件', '名稱'],
            'closure_label' => '閉包',
            'desc' => '路由列表',
        ];

        $en = [
            'title' => '<info>Route list</info>',
            'headers' => ['URI', 'Method', 'Callback', 'Middleware', 'Name'],
            'closure_label' => 'Closure',
            'desc' => 'Route list',
        ];

        $ja = [
            'title' => '<info>ルート一覧</info>',
            'headers' => ['URI', 'メソッド', 'コールバック', 'ミドルウェア', '名前'],
            'closure_label' => 'クロージャ',
            'desc' => 'ルート一覧',
        ];

        $ko = [
            'title' => '<info>라우트 목록</info>',
            'headers' => ['URI', '메서드', '콜백', '미들웨어', '이름'],
            'closure_label' => '클로저',
            'desc' => '라우트 목록',
        ];

        $fr = [
            'title' => '<info>Liste des routes</info>',
            'headers' => ['URI', 'Méthode', 'Callback', 'Middleware', 'Nom'],
            'closure_label' => 'Closure',
            'desc' => 'Liste des routes',
        ];

        $de = [
            'title' => '<info>Routenliste</info>',
            'headers' => ['URI', 'Methode', 'Callback', 'Middleware', 'Name'],
            'closure_label' => 'Closure',
            'desc' => 'Routenliste',
        ];

        $es = [
            'title' => '<info>Lista de rutas</info>',
            'headers' => ['URI', 'Método', 'Callback', 'Middleware', 'Nombre'],
            'closure_label' => 'Closure',
            'desc' => 'Lista de rutas',
        ];

        $pt = [
            'title' => '<info>Lista de rotas</info>',
            'headers' => ['URI', 'Método', 'Callback', 'Middleware', 'Nome'],
            'closure_label' => 'Closure',
            'desc' => 'Lista de rotas',
        ];

        $ru = [
            'title' => '<info>Список маршрутов</info>',
            'headers' => ['URI', 'Метод', 'Обработчик', 'Middleware', 'Имя'],
            'closure_label' => 'Замыкание',
            'desc' => 'Список маршрутов',
        ];

        $vi = [
            'title' => '<info>Danh sách route</info>',
            'headers' => ['URI', 'Phương thức', 'Callback', 'Middleware', 'Tên'],
            'closure_label' => 'Closure',
            'desc' => 'Danh sách route',
        ];

        $tr = [
            'title' => '<info>Rota listesi</info>',
            'headers' => ['URI', 'Metot', 'Callback', 'Middleware', 'Ad'],
            'closure_label' => 'Closure',
            'desc' => 'Rota listesi',
        ];

        $id = [
            'title' => '<info>Daftar rute</info>',
            'headers' => ['URI', 'Metode', 'Callback', 'Middleware', 'Nama'],
            'closure_label' => 'Closure',
            'desc' => 'Daftar rute',
        ];

        $th = [
            'title' => '<info>รายการเส้นทาง</info>',
            'headers' => ['URI', 'เมธอด', 'Callback', 'Middleware', 'ชื่อ'],
            'closure_label' => 'Closure',
            'desc' => 'รายการเส้นทาง',
        ];

        return [
            'zh_CN' => $zh, 'zh_TW' => $tw, 'en' => $en, 'ja' => $ja, 'ko' => $ko,
            'fr' => $fr, 'de' => $de, 'es' => $es, 'pt_BR' => $pt, 'ru' => $ru,
            'vi' => $vi, 'tr' => $tr, 'id' => $id, 'th' => $th,
        ];
    }

    public static function getConnectionsMessages(): array
    {
        return [
            'zh_CN' => ['desc' => '获取 worker 链接'],
            'zh_TW' => ['desc' => '獲取 worker 連結'],
            'en' => ['desc' => 'Get worker connections'],
            'ja' => ['desc' => 'ワーカー接続を取得'],
            'ko' => ['desc' => '워커 연결 가져오기'],
            'fr' => ['desc' => 'Obtenir les connexions worker'],
            'de' => ['desc' => 'Worker-Verbindungen abrufen'],
            'es' => ['desc' => 'Obtener conexiones de worker'],
            'pt_BR' => ['desc' => 'Obter conexões do worker'],
            'ru' => ['desc' => 'Получить соединения worker'],
            'vi' => ['desc' => 'Lấy các kết nối worker'],
            'tr' => ['desc' => 'Worker bağlantılarını al'],
            'id' => ['desc' => 'Dapatkan koneksi worker'],
            'th' => ['desc' => 'รับการเชื่อมต่อ worker'],
        ];
    }



    public static function getVersionMessages(): array
    {
        return [
            'zh_CN' => [
                'desc' => '显示 webman 版本',
                'version' => '<info>Webman-framework 版本</info> <comment>{version}</comment>',
                'not_found' => '<error>无法读取 workerman/webman-framework 版本信息</error>',
            ],
            'zh_TW' => [
                'desc' => '顯示 webman 版本',
                'version' => '<info>Webman-framework 版本</info> <comment>{version}</comment>',
                'not_found' => '<error>無法讀取 workerman/webman-framework 版本資訊</error>',
            ],
            'en' => [
                'desc' => 'Show webman version',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Unable to read version info for workerman/webman-framework</error>',
            ],
            'ja' => [
                'desc' => 'webman のバージョンを表示',
                'version' => '<info>Webman-framework バージョン</info> <comment>{version}</comment>',
                'not_found' => '<error>workerman/webman-framework のバージョン情報を読み取れません</error>',
            ],
            'ko' => [
                'desc' => 'webman 버전 표시',
                'version' => '<info>Webman-framework 버전</info> <comment>{version}</comment>',
                'not_found' => '<error>workerman/webman-framework 버전 정보를 읽을 수 없습니다</error>',
            ],
            'fr' => [
                'desc' => 'Afficher la version de webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Impossible de lire les informations de version de workerman/webman-framework</error>',
            ],
            'de' => [
                'desc' => 'Webman-Version anzeigen',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Versionsinfo für workerman/webman-framework konnte nicht gelesen werden</error>',
            ],
            'es' => [
                'desc' => 'Mostrar la versión de webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>No se pudo leer la información de versión de workerman/webman-framework</error>',
            ],
            'pt_BR' => [
                'desc' => 'Mostrar versão do webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Não foi possível ler as informações de versão do workerman/webman-framework</error>',
            ],
            'ru' => [
                'desc' => 'Показать версию webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Не удалось прочитать информацию о версии workerman/webman-framework</error>',
            ],
            'vi' => [
                'desc' => 'Hiển thị phiên bản webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Không đọc được thông tin phiên bản workerman/webman-framework</error>',
            ],
            'tr' => [
                'desc' => 'Webman sürümünü göster',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>workerman/webman-framework sürüm bilgisi okunamadı</error>',
            ],
            'id' => [
                'desc' => 'Tampilkan versi webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>Tidak dapat membaca info versi workerman/webman-framework</error>',
            ],
            'th' => [
                'desc' => 'แสดงเวอร์ชัน webman',
                'version' => '<info>Webman-framework</info> <comment>{version}</comment>',
                'not_found' => '<error>อ่านข้อมูลเวอร์ชัน workerman/webman-framework ไม่ได้</error>',
            ],
        ];
    }

    public static function getServiceMessages(): array
    {
        $zhCn = [
            'start_desc' => '以 DEBUG 模式启动 worker。使用 -d 参数以 DAEMON 模式启动。',
            'stop_desc' => '停止 worker。使用 -g 参数平滑停止。',
            'reload_desc' => '重载代码。使用 -g 参数平滑重载。',
            'restart_desc' => '重启 worker。使用 -d 参数以 DAEMON 模式启动。使用 -g 参数平滑停止。',
            'status_desc' => '获取 worker 状态。使用 -d 参数显示详情。',
            'daemon_option' => 'DAEMON 模式',
            'graceful_stop' => '平滑停止',
            'graceful_reload' => '平滑重载',
            'live_status' => '显示详情',
        ];

        $zhTw = [
            'start_desc' => '以 DEBUG 模式啟動 worker。使用 -d 參數以 DAEMON 模式啟動。',
            'stop_desc' => '停止 worker。使用 -g 參數平滑停止。',
            'reload_desc' => '重載程式碼。使用 -g 參數平滑重載。',
            'restart_desc' => '重啟 worker。使用 -d 參數以 DAEMON 模式啟動。使用 -g 參數平滑停止。',
            'status_desc' => '獲取 worker 狀態。使用 -d 參數顯示詳情。',
            'daemon_option' => 'DAEMON 模式',
            'graceful_stop' => '平滑停止',
            'graceful_reload' => '平滑重載',
            'live_status' => '顯示詳情',
        ];

        $en = [
            'start_desc' => 'Start worker in DEBUG mode. Use mode -d to start in DAEMON mode.',
            'stop_desc' => 'Stop worker. Use mode -g to stop gracefully.',
            'reload_desc' => 'Reload codes. Use mode -g to reload gracefully.',
            'restart_desc' => 'Restart workers. Use mode -d to start in DAEMON mode. Use mode -g to stop gracefully.',
            'status_desc' => 'Get worker status. Use mode -d to show live status.',
            'daemon_option' => 'DAEMON mode',
            'graceful_stop' => 'graceful stop',
            'graceful_reload' => 'graceful reload',
            'live_status' => 'show live status',
        ];

        return [
            'zh_CN' => $zhCn,
            'zh_TW' => $zhTw,
            'en' => $en,
        ];
    }

    public static function getPluginMessages(): array
    {
        $zhCn = [
            'bad_name' => "<error>插件名无效：{name}\n要求：必须是 composer 包名，格式为 vendor/name（建议全小写），例如 foo/my-admin。</error>",
            'name_conflict' => "<error>参数冲突：位置参数与 --name 不一致：{arg} vs {opt}\n请只保留一个，或确保两者一致。</error>",
            'plugin_not_found' => "<error>插件不存在：{name}\n请先安装该插件（例如：composer require {name}），或确认目录存在：{path}</error>",
            'create_title' => "<info>创建插件</info> <comment>{name}</comment>",
            'enable_title' => "<info>启用插件</info> <comment>{name}</comment>",
            'disable_title' => "<info>禁用插件</info> <comment>{name}</comment>",
            'export_title' => "<info>导出插件</info> <comment>{name}</comment>",
            'install_title' => "<info>执行安装脚本</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>执行卸载脚本</info> <comment>{name}</comment>",
            'missing_name' => "<error>缺少参数：请通过位置参数或 `--name` 指定插件包名（例如 foo/my-admin）。</error>",
            'dir_exists' => "<error>目录已存在：</error> <comment>{path}</comment>",
            'create_failed' => "<error>创建失败：</error> <comment>{error}</comment>",
            'step_psr4' => "<comment>步骤</comment> 添加 PSR-4 映射：<info>{key}</info> -> <info>{path}</info>",
            'psr4_ok' => "<info>PSR-4 映射已写入 composer.json</info>",
            'psr4_failed' => "<error>写入 composer.json 失败：</error> <comment>{error}</comment>",
            'step_config' => "<comment>步骤</comment> 生成配置目录：{path}",
            'step_vendor' => "<comment>步骤</comment> 生成插件代码目录：{path}",
            'created' => "<info>已创建：</info> <comment>{path}</comment>",
            'dumpautoload_ok' => "<info>已执行：</info> composer dumpautoload",
            'dumpautoload_failed' => "<comment>提示</comment> 自动执行失败，请手动运行：<info>{cmd}</info>",
            'dumpautoload_manual' => "<comment>提示</comment> 当前环境无法自动执行命令，请手动运行：<info>{cmd}</info>",
            'done' => "<info>完成</info> 插件 {name} 创建成功",
            'config_file' => "<comment>配置文件</comment> {path}",
            'config_missing' => "<comment>提示</comment> 配置文件不存在，跳过：{path}",
            'enable_key_missing' => "<comment>提示</comment> 配置项 `enable` 不存在，跳过：{path}",
            'already_enabled' => "<comment>提示</comment> 已是启用状态，无需修改",
            'already_disabled' => "<comment>提示</comment> 已是禁用状态，无需修改",
            'enabled_ok' => "<info>已启用</info> {name}",
            'disabled_ok' => "<info>已禁用</info> {name}",
            'updated_ok' => "<info>已更新</info> <comment>{path}</comment>",
            'update_failed' => "<error>更新失败：</error> <comment>{error}</comment>",
            'export_install_created' => "<info>已生成：</info> <comment>{path}</comment>",
            'export_copy' => "<info>复制</info> {src} <comment>→</comment> {dest}",
            'export_skip_missing' => "<comment>跳过</comment> 路径不存在：{path}",
            'export_saved' => "<info>已导出</info> {name} <comment>→</comment> {dest}",
            'script_missing' => "<comment>提示</comment> 未找到安装/卸载脚本（Install::WEBMAN_PLUGIN 或方法不存在）。如刚修改过 composer.json，请先执行：<info>composer dumpautoload</info>",
            'script_ok' => "<info>执行完成</info>",
            'script_failed' => "<error>执行失败：</error> <comment>{error}</comment>",
            'config_key_missing' => "<error>配置项 `{key}` 不存在：</error> <comment>{path}</comment>",
            'description_name' => '插件包名 (vendor/name)',
            'description_source' => '要导出的目录',
        ];

        $en = [
            'bad_name' => "<error>Invalid plugin name: {name}\nIt must be a composer package name in vendor/name format (prefer lowercase), e.g. foo/my-admin.</error>",
            'name_conflict' => "<error>Argument conflict: positional name differs from --name: {arg} vs {opt}\nPlease keep only one or make them identical.</error>",
            'plugin_not_found' => "<error>Plugin not found: {name}\nPlease install it first (e.g. composer require {name}) or ensure directory exists: {path}</error>",
            'create_title' => "<info>Create plugin</info> <comment>{name}</comment>",
            'enable_title' => "<info>Enable plugin</info> <comment>{name}</comment>",
            'disable_title' => "<info>Disable plugin</info> <comment>{name}</comment>",
            'export_title' => "<info>Export plugin</info> <comment>{name}</comment>",
            'install_title' => "<info>Execute install script</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>Execute uninstall script</info> <comment>{name}</comment>",
            'missing_name' => "<error>Missing argument: please provide package name by positional argument or `--name` (e.g. foo/my-admin).</error>",
            'dir_exists' => "<error>Directory already exists:</error> <comment>{path}</comment>",
            'create_failed' => "<error>Failed to create:</error> <comment>{error}</comment>",
            'step_psr4' => "<comment>Step</comment> Add PSR-4 mapping: <info>{key}</info> -> <info>{path}</info>",
            'psr4_ok' => "<info>PSR-4 mapping updated in composer.json</info>",
            'psr4_failed' => "<error>Failed to update composer.json:</error> <comment>{error}</comment>",
            'step_config' => "<comment>Step</comment> Create config directory: {path}",
            'step_vendor' => "<comment>Step</comment> Create plugin source directory: {path}",
            'created' => "<info>Created:</info> <comment>{path}</comment>",
            'dumpautoload_ok' => "<info>Executed:</info> composer dumpautoload",
            'dumpautoload_failed' => "<comment>Note</comment> Auto execution failed, please run manually: <info>{cmd}</info>",
            'dumpautoload_manual' => "<comment>Note</comment> Cannot execute commands in this environment, please run: <info>{cmd}</info>",
            'done' => "<info>Done</info> Plugin {name} created successfully",
            'config_file' => "<comment>Config file</comment> {path}",
            'config_missing' => "<comment>Note</comment> Config file not found, skipped: {path}",
            'enable_key_missing' => "<comment>Note</comment> Config key `enable` not found, skipped: {path}",
            'already_enabled' => "<comment>Note</comment> Already enabled, no changes needed",
            'already_disabled' => "<comment>Note</comment> Already disabled, no changes needed",
            'enabled_ok' => "<info>Enabled</info> {name}",
            'disabled_ok' => "<info>Disabled</info> {name}",
            'updated_ok' => "<info>Updated</info> <comment>{path}</comment>",
            'update_failed' => "<error>Failed to update:</error> <comment>{error}</comment>",
            'export_install_created' => "<info>Generated:</info> <comment>{path}</comment>",
            'export_copy' => "<info>Copy</info> {src} <comment>→</comment> {dest}",
            'export_skip_missing' => "<comment>Skip</comment> Path not found: {path}",
            'export_saved' => "<info>Exported</info> {name} <comment>→</comment> {dest}",
            'script_missing' => "<comment>Note</comment> Install/Uninstall script not found (Install::WEBMAN_PLUGIN or method missing). If you just changed composer.json, please run: <info>composer dumpautoload</info>",
            'script_ok' => "<info>Done</info>",
            'script_failed' => "<error>Execution failed:</error> <comment>{error}</comment>",
            'config_key_missing' => "<error>Config item `{key}` not found:</error> <comment>{path}</comment>",
            'description_name' => 'Plugin package name (vendor/name)',
            'description_source' => 'Source path(s) to export',
        ];

        $zhTw = [
            'bad_name' => "<error>插件名稱無效：{name}\n要求：必須是 composer 套件名，格式為 vendor/name（建議全小寫），例如 foo/my-admin。</error>",
            'name_conflict' => "<error>參數衝突：位置參數與 --name 不一致：{arg} vs {opt}\n請只保留一個，或確保兩者一致。</error>",
            'plugin_not_found' => "<error>插件不存在：{name}\n請先安裝該插件（例如：composer require {name}），或確認目錄存在：{path}</error>",
            'create_title' => "<info>建立插件</info> <comment>{name}</comment>",
            'enable_title' => "<info>啟用插件</info> <comment>{name}</comment>",
            'disable_title' => "<info>停用插件</info> <comment>{name}</comment>",
            'export_title' => "<info>匯出插件</info> <comment>{name}</comment>",
            'install_title' => "<info>執行安裝腳本</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>執行卸載腳本</info> <comment>{name}</comment>",
            'missing_name' => "<error>缺少參數：請透過位置參數或 `--name` 指定插件套件名（例如 foo/my-admin）。</error>",
            'dir_exists' => "<error>目錄已存在：</error> <comment>{path}</comment>",
            'create_failed' => "<error>建立失敗：</error> <comment>{error}</comment>",
            'step_psr4' => "<comment>步驟</comment> 新增 PSR-4 對應：<info>{key}</info> -> <info>{path}</info>",
            'psr4_ok' => "<info>PSR-4 對應已寫入 composer.json</info>",
            'psr4_failed' => "<error>寫入 composer.json 失敗：</error> <comment>{error}</comment>",
            'step_config' => "<comment>步驟</comment> 產生設定目錄：{path}",
            'step_vendor' => "<comment>步驟</comment> 產生插件程式目錄：{path}",
            'created' => "<info>已建立：</info> <comment>{path}</comment>",
            'dumpautoload_ok' => "<info>已執行：</info> composer dumpautoload",
            'dumpautoload_failed' => "<comment>提示</comment> 自動執行失敗，請手動執行：<info>{cmd}</info>",
            'dumpautoload_manual' => "<comment>提示</comment> 目前環境無法自動執行指令，請手動執行：<info>{cmd}</info>",
            'done' => "<info>完成</info> 插件 {name} 建立成功",
            'config_file' => "<comment>設定檔</comment> {path}",
            'config_missing' => "<comment>提示</comment> 設定檔不存在，略過：{path}",
            'enable_key_missing' => "<comment>提示</comment> 設定項 `enable` 不存在，略過：{path}",
            'already_enabled' => "<comment>提示</comment> 已是啟用狀態，無需修改",
            'already_disabled' => "<comment>提示</comment> 已是停用狀態，無需修改",
            'enabled_ok' => "<info>已啟用</info> {name}",
            'disabled_ok' => "<info>已停用</info> {name}",
            'updated_ok' => "<info>已更新</info> <comment>{path}</comment>",
            'update_failed' => "<error>更新失敗：</error> <comment>{error}</comment>",
            'export_install_created' => "<info>已產生：</info> <comment>{path}</comment>",
            'export_copy' => "<info>複製</info> {src} <comment>→</comment> {dest}",
            'export_skip_missing' => "<comment>略過</comment> 路徑不存在：{path}",
            'export_saved' => "<info>已匯出</info> {name} <comment>→</comment> {dest}",
            'script_missing' => "<comment>提示</comment> 未找到安裝/卸載腳本（Install::WEBMAN_PLUGIN 或方法不存在）。如剛修改過 composer.json，請先執行：<info>composer dumpautoload</info>",
            'script_ok' => "<info>執行完成</info>",
            'script_failed' => "<error>執行失敗：</error> <comment>{error}</comment>",
            'config_key_missing' => "<error>設定項 `{key}` 不存在：</error> <comment>{path}</comment>",
            'description_name' => '插件套件名 (vendor/name)',
            'description_source' => '要匯出的目錄',
        ];

        $ja = [
            'bad_name' => "<error>無効なプラグイン名：{name}\ncomposer パッケージ名（vendor/name、小文字推奨）が必要です。例：foo/my-admin。</error>",
            'name_conflict' => "<error>引数の衝突：位置引数と --name が一致しません：{arg} vs {opt}\nどちらか一方に統一してください。</error>",
            'plugin_not_found' => "<error>プラグインが見つかりません：{name}\n先にインストール（例：composer require {name}）するか、ディレクトリ {path} の存在を確認してください。</error>",
            'create_title' => "<info>プラグインを作成</info> <comment>{name}</comment>",
            'enable_title' => "<info>プラグインを有効化</info> <comment>{name}</comment>",
            'disable_title' => "<info>プラグインを無効化</info> <comment>{name}</comment>",
            'export_title' => "<info>プラグインをエクスポート</info> <comment>{name}</comment>",
            'install_title' => "<info>インストールスクリプトを実行</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>アンインストールスクリプトを実行</info> <comment>{name}</comment>",
            'missing_name' => "<error>引数がありません。位置引数または `--name` でパッケージ名（例：foo/my-admin）を指定してください。</error>",
            'dir_exists' => "<error>ディレクトリが既に存在します：</error> <comment>{path}</comment>",
            'create_failed' => "<error>作成に失敗しました：</error> <comment>{error}</comment>",
            'step_psr4' => "<comment>手順</comment> PSR-4 マッピングを追加：<info>{key}</info> -> <info>{path}</info>",
            'psr4_ok' => "<info>composer.json に PSR-4 マッピングを反映しました</info>",
            'psr4_failed' => "<error>composer.json の更新に失敗しました：</error> <comment>{error}</comment>",
            'step_config' => "<comment>手順</comment> 設定ディレクトリを作成：{path}",
            'step_vendor' => "<comment>手順</comment> プラグインソースディレクトリを作成：{path}",
            'created' => "<info>作成しました：</info> <comment>{path}</comment>",
            'dumpautoload_ok' => "<info>実行しました：</info> composer dumpautoload",
            'dumpautoload_failed' => "<comment>注意</comment> 自動実行に失敗しました。手動で実行してください：<info>{cmd}</info>",
            'dumpautoload_manual' => "<comment>注意</comment> この環境ではコマンドを自動実行できません。手動で <info>{cmd}</info> を実行してください。",
            'done' => "<info>完了</info> プラグイン {name} の作成に成功しました",
            'config_file' => "<comment>設定ファイル</comment> {path}",
            'config_missing' => "<comment>注意</comment> 設定ファイルが見つかりません。スキップ：{path}",
            'enable_key_missing' => "<comment>注意</comment> 設定キー `enable` が見つかりません。スキップ：{path}",
            'already_enabled' => "<comment>注意</comment> 既に有効です。変更不要です。",
            'already_disabled' => "<comment>注意</comment> 既に無効です。変更不要です。",
            'enabled_ok' => "<info>有効にしました</info> {name}",
            'disabled_ok' => "<info>無効にしました</info> {name}",
            'updated_ok' => "<info>更新しました</info> <comment>{path}</comment>",
            'update_failed' => "<error>更新に失敗しました：</error> <comment>{error}</comment>",
            'export_install_created' => "<info>生成しました：</info> <comment>{path}</comment>",
            'export_copy' => "<info>コピー</info> {src} <comment>→</comment> {dest}",
            'export_skip_missing' => "<comment>スキップ</comment> パスが見つかりません：{path}",
            'export_saved' => "<info>エクスポートしました</info> {name} <comment>→</comment> {dest}",
            'script_missing' => "<comment>注意</comment> インストール/アンインストールスクリプトが見つかりません（Install::WEBMAN_PLUGIN またはメソッドがありません）。composer.json を変更した場合は <info>composer dumpautoload</info> を実行してください。",
            'script_ok' => "<info>完了</info>",
            'script_failed' => "<error>実行に失敗しました：</error> <comment>{error}</comment>",
            'config_key_missing' => "<error>設定キー `{key}` が見つかりません：</error> <comment>{path}</comment>",
            'description_name' => 'プラグインパッケージ名 (vendor/name)',
            'description_source' => 'エクスポートするパス',
        ];

        $ko = [
            'bad_name' => "<error>잘못된 플러그인 이름: {name}\ncomposer 패키지 이름(vendor/name, 소문자 권장)이어야 합니다. 예: foo/my-admin.</error>",
            'name_conflict' => "<error>인자 충돌: 위치 인자와 --name이 일치하지 않습니다: {arg} vs {opt}\n하나만 사용하거나 동일하게 맞추세요.</error>",
            'plugin_not_found' => "<error>플러그인을 찾을 수 없습니다: {name}\n먼저 설치하세요(예: composer require {name}) 또는 디렉터리 존재 여부 확인: {path}</error>",
            'create_title' => "<info>플러그인 생성</info> <comment>{name}</comment>",
            'enable_title' => "<info>플러그인 활성화</info> <comment>{name}</comment>",
            'disable_title' => "<info>플러그인 비활성화</info> <comment>{name}</comment>",
            'export_title' => "<info>플러그인 내보내기</info> <comment>{name}</comment>",
            'install_title' => "<info>설치 스크립트 실행</info> <comment>{name}</comment>",
            'uninstall_title' => "<info>제거 스크립트 실행</info> <comment>{name}</comment>",
            'missing_name' => "<error>인자가 없습니다. 위치 인자 또는 `--name`으로 패키지 이름(예: foo/my-admin)을 지정하세요.</error>",
            'dir_exists' => "<error>디렉터리가 이미 있습니다:</error> <comment>{path}</comment>",
            'create_failed' => "<error>생성 실패:</error> <comment>{error}</comment>",
            'step_psr4' => "<comment>단계</comment> PSR-4 매핑 추가: <info>{key}</info> -> <info>{path}</info>",
            'psr4_ok' => "<info>composer.json에 PSR-4 매핑이 반영되었습니다</info>",
            'psr4_failed' => "<error>composer.json 업데이트 실패:</error> <comment>{error}</comment>",
            'step_config' => "<comment>단계</comment> 설정 디렉터리 생성: {path}",
            'step_vendor' => "<comment>단계</comment> 플러그인 소스 디렉터리 생성: {path}",
            'created' => "<info>생성됨:</info> <comment>{path}</comment>",
            'dumpautoload_ok' => "<info>실행됨:</info> composer dumpautoload",
            'dumpautoload_failed' => "<comment>참고</comment> 자동 실행에 실패했습니다. 수동으로 실행하세요: <info>{cmd}</info>",
            'dumpautoload_manual' => "<comment>참고</comment> 이 환경에서는 명령을 자동 실행할 수 없습니다. 수동으로 <info>{cmd}</info>를 실행하세요.",
            'done' => "<info>완료</info> 플러그인 {name}이(가) 성공적으로 생성되었습니다",
            'config_file' => "<comment>설정 파일</comment> {path}",
            'config_missing' => "<comment>참고</comment> 설정 파일을 찾을 수 없어 건너뜁니다: {path}",
            'enable_key_missing' => "<comment>참고</comment> 설정 키 `enable`을 찾을 수 없어 건너뜁니다: {path}",
            'already_enabled' => "<comment>참고</comment> 이미 활성화되어 있습니다. 변경할 필요 없습니다.",
            'already_disabled' => "<comment>참고</comment> 이미 비활성화되어 있습니다. 변경할 필요 없습니다.",
            'enabled_ok' => "<info>활성화됨</info> {name}",
            'disabled_ok' => "<info>비활성화됨</info> {name}",
            'updated_ok' => "<info>업데이트됨</info> <comment>{path}</comment>",
            'update_failed' => "<error>업데이트 실패:</error> <comment>{error}</comment>",
            'export_install_created' => "<info>생성됨:</info> <comment>{path}</comment>",
            'export_copy' => "<info>복사</info> {src} <comment>→</comment> {dest}",
            'export_skip_missing' => "<comment>건너뜀</comment> 경로를 찾을 수 없습니다: {path}",
            'export_saved' => "<info>내보냄</info> {name} <comment>→</comment> {dest}",
            'script_missing' => "<comment>참고</comment> 설치/제거 스크립트를 찾을 수 없습니다(Install::WEBMAN_PLUGIN 또는 메서드 없음). composer.json을 수정했다면 <info>composer dumpautoload</info>를 실행하세요.",
            'script_ok' => "<info>완료</info>",
            'script_failed' => "<error>실행 실패:</error> <comment>{error}</comment>",
            'config_key_missing' => "<error>설정 키 `{key}` 없음:</error> <comment>{path}</comment>",
            'description_name' => '플러그인 패키지 이름 (vendor/name)',
            'description_source' => '내보낼 경로',
        ];

        return [
            'zh_CN' => $zhCn,
            'zh_TW' => $zhTw,
            'en' => $en,
            'ja' => $ja,
            'ko' => $ko,
        ];
    }

    public static function getPluginCreateHelpText(): array
    {
        $zhCn = <<<'EOF'
创建一个 Webman 插件骨架（composer 包形式）。

用法：
  php webman plugin:create foo/my-admin
  php webman plugin:create --name foo/my-admin

说明：
  - 插件名必须是 composer 包名：vendor/name（全小写）。
  - 会创建目录：
      - config/plugin/<vendor>/<name>
      - vendor/<vendor>/<name>/src
  - 会在项目 composer.json 的 autoload.psr-4 中追加命名空间映射，并尝试执行 `composer dumpautoload`。
EOF;
        $zhTw = <<<'EOF'
建立一個 Webman 外掛骨架（composer 套件形式）。

用法：
  php webman plugin:create foo/my-admin
  php webman plugin:create --name foo/my-admin

說明：
  - 外掛名稱必須為 composer 套件名：vendor/name（全小寫）。
  - 會建立目錄：
      - config/plugin/<vendor>/<name>
      - vendor/<vendor>/<name>/src
  - 會在專案 composer.json 的 autoload.psr-4 中追加命名空間對應，並嘗試執行 `composer dumpautoload`。
EOF;
        $en = <<<'EOF'
Create a Webman plugin skeleton (as a composer package).

Usage:
  php webman plugin:create foo/my-admin
  php webman plugin:create --name foo/my-admin

Notes:
  - Plugin name must be a composer package name: vendor/name (lowercase).
  - It will create:
      - config/plugin/<vendor>/<name>
      - vendor/<vendor>/<name>/src
  - It will append a PSR-4 mapping to the project's composer.json and try to run `composer dumpautoload`.
EOF;
        return [
            'zh_CN' => $zhCn, 'zh_TW' => $zhTw, 'en' => $en,
            'ja' => "Webman プラグインのスケルトンを作成（composer パッケージとして）。\n\n使い方：\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\n説明：\n  - プラグイン名は composer パッケージ名（vendor/name、すべて小文字）である必要があります。\n  - 作成するもの：config/plugin/<vendor>/<name>、vendor/<vendor>/<name>/src\n  - プロジェクトの composer.json に PSR-4 マッピングを追加し `composer dumpautoload` を実行します。",
            'ko' => "Webman 플러그인 스켈레톤 생성 (composer 패키지로).\n\n사용법:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\n참고:\n  - 플러그인 이름은 composer 패키지명: vendor/name(소문자).\n  - 생성: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - 프로젝트 composer.json에 PSR-4 매핑 추가 후 `composer dumpautoload` 실행.",
            'fr' => "Créer un squelette de plugin Webman (en tant que paquet composer).\n\nUsage :\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nNotes :\n  - Le nom doit être un paquet composer : vendor/name (minuscules).\n  - Crée : config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Ajoute le mapping PSR-4 dans composer.json et exécute `composer dumpautoload`.",
            'de' => "Webman-Plugin-Gerüst erstellen (als Composer-Paket).\n\nVerwendung:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nHinweise:\n  - Plugin-Name muss Composer-Paketname sein: vendor/name (Kleinbuchstaben).\n  - Erstellt: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Fügt PSR-4-Mapping in composer.json ein und führt `composer dumpautoload` aus.",
            'es' => "Crear esqueleto de plugin Webman (como paquete composer).\n\nUso:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nNotas:\n  - El nombre debe ser un paquete composer: vendor/name (minúsculas).\n  - Crea: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Añade mapeo PSR-4 en composer.json e intenta ejecutar `composer dumpautoload`.",
            'pt_BR' => "Criar esqueleto de plugin Webman (como pacote composer).\n\nUso:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nNotas:\n  - Nome deve ser pacote composer: vendor/name (minúsculas).\n  - Cria: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Adiciona mapeamento PSR-4 no composer.json e tenta executar `composer dumpautoload`.",
            'ru' => "Создать каркас плагина Webman (как пакет composer).\n\nИспользование:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nПримечания:\n  - Имя должно быть именем пакета composer: vendor/name (нижний регистр).\n  - Создаёт: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Добавляет маппинг PSR-4 в composer.json и запускает `composer dumpautoload`.",
            'vi' => "Tạo khung plugin Webman (dưới dạng gói composer).\n\nCách dùng:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nLưu ý:\n  - Tên plugin phải là tên gói composer: vendor/name (chữ thường).\n  - Tạo: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Thêm ánh xạ PSR-4 vào composer.json và chạy `composer dumpautoload`.",
            'tr' => "Webman eklenti iskeleti oluştur (composer paketi olarak).\n\nKullanım:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nNotlar:\n  - Eklenti adı composer paket adı olmalı: vendor/name (küçük harf).\n  - Oluşturur: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - composer.json'a PSR-4 eşlemesi ekler ve `composer dumpautoload` çalıştırır.",
            'id' => "Buat kerangka plugin Webman (sebagai paket composer).\n\nPenggunaan:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nCatatan:\n  - Nama plugin harus nama paket composer: vendor/name (huruf kecil).\n  - Membuat: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - Menambah pemetaan PSR-4 ke composer.json dan menjalankan `composer dumpautoload`.",
            'th' => "สร้างโครงปลั๊กอิน Webman (เป็นแพ็กเกจ composer)\n\nวิธีใช้:\n  php webman plugin:create foo/my-admin\n  php webman plugin:create --name foo/my-admin\n\nหมายเหตุ:\n  - ชื่อปลั๊กอินต้องเป็นชื่อแพ็กเกจ composer: vendor/name (ตัวพิมพ์เล็ก)\n  - สร้าง: config/plugin/<vendor>/<name>, vendor/<vendor>/<name>/src\n  - เพิ่ม PSR-4 mapping ใน composer.json และรัน `composer dumpautoload`",
        ];
    }

    public static function getPluginDisableHelpText(): array
    {
        $zh = <<<'EOF'
禁用指定插件（修改 config/plugin/<vendor>/<name>/app.php 中的 enable 值）。

用法：
  php webman plugin:disable foo/my-admin
  php webman plugin:disable --name foo/my-admin
EOF;
        $zhTW = <<<'EOF'
停用指定外掛（修改 config/plugin/<vendor>/<name>/app.php 中的 enable 值）。

用法：
  php webman plugin:disable foo/my-admin
  php webman plugin:disable --name foo/my-admin
EOF;
        $en = <<<'EOF'
Disable a plugin (toggle enable in config/plugin/<vendor>/<name>/app.php).

Usage:
  php webman plugin:disable foo/my-admin
  php webman plugin:disable --name foo/my-admin
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "プラグインを無効化（config/plugin/<vendor>/<name>/app.php の enable を切り替え）。\n\n使い方：\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'ko' => "플러그인 비활성화 (config/plugin/<vendor>/<name>/app.php의 enable 변경).\n\n사용법:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'fr' => "Désactiver un plugin (modifier enable dans config/plugin/<vendor>/<name>/app.php).\n\nUsage :\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'de' => "Plugin deaktivieren (enable in config/plugin/<vendor>/<name>/app.php umschalten).\n\nVerwendung:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'es' => "Desactivar un plugin (cambiar enable en config/plugin/<vendor>/<name>/app.php).\n\nUso:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'pt_BR' => "Desativar um plugin (alterar enable em config/plugin/<vendor>/<name>/app.php).\n\nUso:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'ru' => "Отключить плагин (изменить enable в config/plugin/<vendor>/<name>/app.php).\n\nИспользование:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'vi' => "Tắt plugin (đổi enable trong config/plugin/<vendor>/<name>/app.php).\n\nCách dùng:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'tr' => "Eklentiyi devre dışı bırak (config/plugin/<vendor>/<name>/app.php içinde enable değiştir).\n\nKullanım:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'id' => "Nonaktifkan plugin (ubah enable di config/plugin/<vendor>/<name>/app.php).\n\nPenggunaan:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
            'th' => "ปิดใช้งานปลั๊กอิน (เปลี่ยน enable ใน config/plugin/<vendor>/<name>/app.php)\n\nวิธีใช้:\n  php webman plugin:disable foo/my-admin\n  php webman plugin:disable --name foo/my-admin",
        ];
    }

    public static function getPluginEnableHelpText(): array
    {
        $zh = <<<'EOF'
启用指定插件（将 config/plugin/<vendor>/<name>/app.php 中的 enable 设置为 true）。

用法：
  php webman plugin:enable foo/my-admin
  php webman plugin:enable --name foo/my-admin
EOF;
        $zhTW = <<<'EOF'
啟用指定外掛（將 config/plugin/<vendor>/<name>/app.php 中的 enable 設為 true）。

用法：
  php webman plugin:enable foo/my-admin
  php webman plugin:enable --name foo/my-admin
EOF;
        $en = <<<'EOF'
Enable a plugin (set enable to true in config/plugin/<vendor>/<name>/app.php).

Usage:
  php webman plugin:enable foo/my-admin
  php webman plugin:enable --name foo/my-admin
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "プラグインを有効化（config/plugin/<vendor>/<name>/app.php の enable を true に設定）。\n\n使い方：\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'ko' => "플러그인 활성화 (config/plugin/<vendor>/<name>/app.php의 enable을 true로 설정).\n\n사용법:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'fr' => "Activer un plugin (mettre enable à true dans config/plugin/<vendor>/<name>/app.php).\n\nUsage :\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'de' => "Plugin aktivieren (enable in config/plugin/<vendor>/<name>/app.php auf true setzen).\n\nVerwendung:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'es' => "Activar un plugin (establecer enable como true en config/plugin/<vendor>/<name>/app.php).\n\nUso:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'pt_BR' => "Ativar um plugin (definir enable como true em config/plugin/<vendor>/<name>/app.php).\n\nUso:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'ru' => "Включить плагин (установить enable в true в config/plugin/<vendor>/<name>/app.php).\n\nИспользование:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'vi' => "Bật plugin (đặt enable thành true trong config/plugin/<vendor>/<name>/app.php).\n\nCách dùng:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'tr' => "Eklentiyi etkinleştir (config/plugin/<vendor>/<name>/app.php içinde enable true yap).\n\nKullanım:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'id' => "Aktifkan plugin (atur enable ke true di config/plugin/<vendor>/<name>/app.php).\n\nPenggunaan:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
            'th' => "เปิดใช้งานปลั๊กอิน (ตั้งค่า enable เป็น true ใน config/plugin/<vendor>/<name>/app.php)\n\nวิธีใช้:\n  php webman plugin:enable foo/my-admin\n  php webman plugin:enable --name foo/my-admin",
        ];
    }

    public static function getPluginExportHelpText(): array
    {
        $zh = <<<'EOF'
导出指定插件为本地骨架文件（用于离线分发或二次开发）。

用法：
  php webman plugin:export foo/my-admin
  php webman plugin:export --name foo/my-admin
EOF;
        $zhTW = <<<'EOF'
匯出指定外掛為本機骨架檔案（用於離線分發或二次開發）。

用法：
  php webman plugin:export foo/my-admin
  php webman plugin:export --name foo/my-admin
EOF;
        $en = <<<'EOF'
Export a plugin as local skeleton files (for offline distribution or development).

Usage:
  php webman plugin:export foo/my-admin
  php webman plugin:export --name foo/my-admin
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "プラグインをローカルのスケルトンファイルとしてエクスポート（オフライン配布や開発用）。\n\n使い方：\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'ko' => "플러그인을 로컬 스켈레톤 파일로 내보내기 (오프라인 배포 또는 개발용).\n\n사용법:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'fr' => "Exporter un plugin en fichiers squelettes locaux (pour distribution hors ligne ou développement).\n\nUsage :\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'de' => "Plugin als lokale Skeleton-Dateien exportieren (für Offline-Distribution oder Entwicklung).\n\nVerwendung:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'es' => "Exportar un plugin como archivos de esqueleto locales (para distribución offline o desarrollo).\n\nUso:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'pt_BR' => "Exportar um plugin como arquivos de esqueleto locais (para distribuição offline ou desenvolvimento).\n\nUso:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'ru' => "Экспортировать плагин как локальные файлы каркаса (для офлайн-дистрибуции или разработки).\n\nИспользование:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'vi' => "Xuất plugin dưới dạng các tệp khung cục bộ (để phân phối ngoại tuyến hoặc phát triển).\n\nCách dùng:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'tr' => "Eklentiyi yerel iskelet dosyaları olarak dışa aktar (çevrimdışı dağıtım veya geliştirme için).\n\nKullanım:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'id' => "Ekspor plugin sebagai file kerangka lokal (untuk distribusi offline atau pengembangan).\n\nPenggunaan:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
            'th' => "ส่งออกปลั๊กอินเป็นไฟล์โครงสร้างท้องถิ่น (สำหรับการแจกจ่ายแบบออฟไลน์หรือการพัฒนาต่อ)\n\nวิธีใช้:\n  php webman plugin:export foo/my-admin\n  php webman plugin:export --name foo/my-admin",
        ];
    }

    public static function getPluginInstallHelpText(): array
    {
        $zh = <<<'EOF'
手动触发插件的安装脚本（Install.php）。通常在 composer require 后自动执行。

用法：
  php webman plugin:install foo/my-admin
  php webman plugin:install --name foo/my-admin
EOF;
        $zhTW = <<<'EOF'
手動觸發外掛的安裝腳本（Install.php）。通常在 composer require 後自動執行。

用法：
  php webman plugin:install foo/my-admin
  php webman plugin:install --name foo/my-admin
EOF;
        $en = <<<'EOF'
Manually trigger the plugin's install script (Install.php). Usually runs automatically after composer require.

Usage:
  php webman plugin:install foo/my-admin
  php webman plugin:install --name foo/my-admin
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "プラグインのインストールスクリプト（Install.php）を手動で実行。通常は composer require 後に自動実行されます。\n\n使い方：\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'ko' => "플러그인의 설치 스크립트(Install.php)를 수동으로 실행. 보통 composer require 후에 자동 실행됩니다.\n\n사용법:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'fr' => "Déclencher manuellement le script d'installation du plugin (Install.php). Il s'exécute normalement automatiquement après composer require.\n\nUsage :\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'de' => "Installationsskript des Plugins (Install.php) manuell auslösen. Wird normalerweise automatisch nach composer require ausgeführt.\n\nVerwendung:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'es' => "Activar manualmente el script de instalación del plugin (Install.php). Normalmente se ejecuta automáticamente después de composer require.\n\nUso:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'pt_BR' => "Acionar manualmente o script de instalação do plugin (Install.php). Geralmente é executado automaticamente após composer require.\n\nUso:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'ru' => "Вручную запустить инсталляционный скрипт плагина (Install.php). Обычно запускается автоматически после composer require.\n\nИспользование:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'vi' => "Kích hoạt thủ công tập lệnh cài đặt của plugin (Install.php). Thường tự động chạy sau khi chạy composer require.\n\nCách dùng:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'tr' => "Eklentinin kurulum betiğini (Install.php) manuel olarak tetikleyin. Genellikle composer require sonrası otomatik çalışır.\n\nKullanım:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'id' => "Memicu skrip penginstalan plugin secara manual (Install.php). Biasanya berjalan secara otomatis setelah composer require.\n\nPenggunaan:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
            'th' => "เรียกใช้งานสคริปต์ติดตั้งปลั๊กอินด้วยตนเอง (Install.php) ปกติจะทำงานโดยอัตโนมัติหลังจากรัน composer require\n\nวิธีใช้:\n  php webman plugin:install foo/my-admin\n  php webman plugin:install --name foo/my-admin",
        ];
    }

    public static function getPluginUninstallHelpText(): array
    {
        $zh = <<<'EOF'
手动触发插件的卸载脚本（Install.php@uninstall）。通常在 composer remove 前自动执行。

用法：
  php webman plugin:uninstall foo/my-admin
  php webman plugin:uninstall --name foo/my-admin
EOF;
        $zhTW = <<<'EOF'
手動觸發外掛的卸載腳本（Install.php@uninstall）。通常在 composer remove 前自動執行。

用法：
  php webman plugin:uninstall foo/my-admin
  php webman plugin:uninstall --name foo/my-admin
EOF;
        $en = <<<'EOF'
Manually trigger the plugin's uninstall script (Install.php@uninstall). Usually runs automatically before composer remove.

Usage:
  php webman plugin:uninstall foo/my-admin
  php webman plugin:uninstall --name foo/my-admin
EOF;
        return [
            'zh_CN' => $zh, 'zh_TW' => $zhTW, 'en' => $en,
            'ja' => "プラグインのアンインストールスクリプト（Install.php@uninstall）を手動で実行。通常は composer remove 前に自動実行されます。\n\n使い方：\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'ko' => "플러그인의 제거 스크립트(Install.php@uninstall)를 수동으로 실행. 보통 composer remove 이전에 자동 실행됩니다.\n\n사용법:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'fr' => "Déclencher manuellement le script de désinstallation du plugin (Install.php@uninstall). Il s'exécute normalement automatiquement avant composer remove.\n\nUsage :\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'de' => "Deinstallationsskript des Plugins (Install.php@uninstall) manuell auslösen. Wird normalerweise automatisch vor composer remove ausgeführt.\n\nVerwendung:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'es' => "Activar manualmente el script de desinstalación del plugin (Install.php@uninstall). Normalmente se ejecuta automáticamente antes de composer remove.\n\nUso:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'pt_BR' => "Acionar manualmente o script de desinstalação do plugin (Install.php@uninstall). Geralmente é executado automaticamente antes de composer remove.\n\nUso:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'ru' => "Вручную запустить скрипт удаления плагина (Install.php@uninstall). Обычно запускается автоматически перед composer remove.\n\nИспользование:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'vi' => "Kích hoạt thủ công tập lệnh gỡ cài đặt của plugin (Install.php@uninstall). Thường tự động chạy trước khi composer remove.\n\nCách dùng:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'tr' => "Eklentinin kaldırma betiğini (Install.php@uninstall) manuel olarak tetikleyin. Genellikle composer remove öncesi otomatik çalışır.\n\nKullanım:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'id' => "Memicu skrip penghapusan plugin secara manual (Install.php@uninstall). Biasanya berjalan secara otomatis sebelum composer remove.\n\nPenggunaan:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
            'th' => "เรียกใช้งานสคริปต์ถอนการติดตั้งปลั๊กอินด้วยตนเอง (Install.php@uninstall) ปกติจะทำงานโดยอัตโนมัติก่อนรัน composer remove\n\nวิธีใช้:\n  php webman plugin:uninstall foo/my-admin\n  php webman plugin:uninstall --name foo/my-admin",
        ];
    }
}
