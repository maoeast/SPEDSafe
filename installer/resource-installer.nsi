; 特教安全教育资源包 安装引导器
; 由 build-resource-installer.js 生成
;
; 工作原理:
;   NSIS 引导器内嵌 7za.exe，运行时释放到临时目录。
;   构建脚本将 resources.7z 追加到 NSIS exe 末尾。
;   NSIS 将自身 exe 复制为临时文件，用 7za 从中提取（7za 能跳过 SFX 前缀）。
;   7za 会自动识别 exe 尾部的 7z 数据并解压。

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!define PRODUCT_NAME "特教安全教育资源包"
!define PRODUCT_VERSION "__VERSION__"
!define MAIN_APP_ID "com.spedsafe.app"
!define REG_UNINSTALL "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${MAIN_APP_ID}"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "__OUTPUT_FILE__"
InstallDir "D:\Program Files\SpedSafe"
RequestExecutionLevel admin
ShowInstDetails show
Unicode true

!define MUI_ICON "__NSIS_ICON__"
!define MUI_UNICON "__NSIS_ICON__"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
Page custom PathPage PathPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Var PathInput
Var BrowseBtn
Var DetectedPath

Function .onInit
    ReadRegStr $DetectedPath HKLM "${REG_UNINSTALL}" "InstallLocation"
    ${If} $DetectedPath == ""
        ReadRegStr $DetectedPath HKCU "${REG_UNINSTALL}" "InstallLocation"
    ${EndIf}
    ${If} $DetectedPath != ""
        StrCpy $INSTDIR $DetectedPath
    ${EndIf}
FunctionEnd

Function PathPage
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
        Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 24u "请选择特教安全教育资源仪的安装目录："
    Pop $0
    ${If} $DetectedPath != ""
        ${NSD_CreateLabel} 0 28u 100% 16u "已自动检测到主程序安装路径。"
    ${Else}
        ${NSD_CreateLabel} 0 28u 100% 16u "未检测到主程序，请手动选择安装目录。"
    ${EndIf}
    Pop $0
    ${NSD_CreateText} 0 52u -80u 14u "$INSTDIR"
    Pop $PathInput
    ${NSD_CreateButton} -75u 52u 75u 14u "浏览..."
    Pop $BrowseBtn
    ${NSD_OnClick} $BrowseBtn OnBrowse
    nsDialogs::Show
FunctionEnd

Function OnBrowse
    nsDialogs::SelectFolderDialog "选择主程序安装目录" "$INSTDIR"
    Pop $0
    ${If} $0 != "error"
        StrCpy $INSTDIR $0
        ${NSD_SetText} $PathInput "$INSTDIR"
    ${EndIf}
FunctionEnd

Function PathPageLeave
    ${NSD_GetText} $PathInput $INSTDIR
    IfFileExists "$INSTDIR\resources\app.asar" done
    MessageBox MB_YESNO|MB_ICONEXCLAMATION \
        "所选目录中未找到主程序（缺少 resources\app.asar）。$\n$\n\
        请确认已先安装「特教安全教育资源仪」主程序。$\n$\n\
        是否仍然继续？" \
        /SD IDNO IDYES done
    Abort
done:
FunctionEnd

Section "安装资源" SecInstall
    SetOverwrite on
    InitPluginsDir

    ; 释放 7z.exe 到临时目录
    SetOutPath "$PLUGINSDIR"
    File "/oname=7z.exe" "__7ZA_EXE__"

    ; 获取自身 exe 路径
    System::Call 'kernel32::GetModuleFileName(i0, t.r0, i${NSIS_MAX_STRLEN})'

    ; 7z.exe 可以直接从 SFX 格式（exe+7z）中提取 7z 数据
    ; 直接用自身 exe 作为输入即可
    DetailPrint "正在解压资源文件到 $INSTDIR..."
    nsExec::ExecToLog '"$PLUGINSDIR\7z.exe" x -y "-o$INSTDIR" "$0"'

    Pop $0
    ${If} $0 == "0"
        DetailPrint "资源安装完成！"
    ${Else}
        DetailPrint "解压返回代码: $0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "资源解压过程中出现错误（代码 $0），请重试。"
    ${EndIf}

    Delete "$PLUGINSDIR\7z.exe"
SectionEnd
