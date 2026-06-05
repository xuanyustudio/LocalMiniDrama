# 使用系统自带的PowerShell执行
# 1.将ComfyUI包装成标准的OpenAI API接口
CD C:\ComfyUI
git clone https://github.com/pnyxai/comfyui-openai-api.git
# 2.进入目录
CD C:\ComfyUI\comfyui-openai-api\apps\rust\comfyui-openai-api
# 3.安装ComFyUI OpenAI API代理环境支持-Rust 
https://rust-lang.org/zh-CN/tools/install/
#4.编译ComFyUI OpenAI API代理程序代码-Rust
cargo clean
cargo build --release
# 5.启动组件 终端显示 Proxy server listening on 0.0.0.0:8080为成功。
./target/release/comfyui-openai-api

# 生成的OpenAI API接口地址http://127.0.0.1:8080/v1/images/generations 

感谢群友 欧先生@全力以赴  整理的教程