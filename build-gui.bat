@echo off
REM 激活码生成工具打包脚本
REM 用于将 Python 脚本打包为独立 .exe 文件

echo ========================================
echo 特教安全教育资源仪 - 激活码生成工具
echo 打包脚本
echo ========================================
echo.

REM 检查 Python 和 PyInstaller
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

echo ✓ Python 已安装
echo.

REM 检查是否存在虚拟环境
if not exist venv (
    echo 创建虚拟环境...
    python -m venv venv
    echo ✓ 虚拟环境已创建
) else (
    echo ✓ 虚拟环境已存在
)

echo.

REM 激活虚拟环境并安装依赖
echo 激活虚拟环境并安装依赖...
call venv\Scripts\activate.bat

pip install --upgrade pip -q
pip install -r requirements-gui.txt -q

if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo ✓ 依赖已安装
echo.

REM 创建输出目录
if not exist dist (
    mkdir dist
)

REM 打包为 EXE
echo 正在打包为 EXE 文件...
echo 这可能需要几分钟，请耐心等待...
echo.

pyinstaller --onefile ^
    --windowed ^
    --name "激活码生成工具" ^
    --icon=icons/icon.ico ^
    --add-data ".keys/private.pem:." ^
    --distpath "dist/exe" ^
    --build-temp "build" ^
    --specpath "spec" ^
    license_generator_gui.py

if errorlevel 1 (
    echo 错误: 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ 打包完成！
echo ========================================
echo.
echo 可执行文件位置:
echo dist\exe\激活码生成工具.exe
echo.
echo 使用方法:
echo 双击 激活码生成工具.exe 即可运行
echo.
pause
