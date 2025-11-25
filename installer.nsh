; 自定义默认安装目录为 D:\Program Files\SpedSafe
!macro customInstall
    ; 这个宏在安装过程中执行
!macroend

!macro preInit
    ; 设置默认安装目录
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Program Files\SpedSafe"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Program Files\SpedSafe"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Program Files\SpedSafe"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\Program Files\SpedSafe"
!macroend
