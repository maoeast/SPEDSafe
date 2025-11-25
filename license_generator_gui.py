"""
特教安全教育资源仪 - 激活码生成工具 GUI
基于 PyQt5 开发的图形界面激活码生成器
"""

import sys
import json
import struct
from datetime import datetime, timedelta
from pathlib import Path
import hashlib
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend
import pyperclip
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QComboBox, QSpinBox, QTextEdit,
    QMessageBox, QTableWidget, QTableWidgetItem, QSplitter, QGroupBox,
    QDateEdit, QCheckBox
)
from PyQt5.QtCore import Qt, QDate, QSettings
from PyQt5.QtGui import QFont, QIcon, QColor
from PyQt5.QtWidgets import QTabWidget, QFileDialog

# ============ 常量配置 ============
LICENSE_VERSION = '1.0'
RSA_KEY_SIZE = 2048
APP_NAME = '激活码生成工具'
APP_VERSION = '1.0'


class LicenseGenerator:
    """激活码加密生成器"""
    
    def __init__(self, private_key_pem=None):
        self.private_key = None
        if private_key_pem:
            self.load_private_key(private_key_pem)
    
    def load_private_key(self, private_key_pem):
        """加载RSA私钥"""
        try:
            self.private_key = serialization.load_pem_private_key(
                private_key_pem.encode() if isinstance(private_key_pem, str) else private_key_pem,
                password=None,
                backend=default_backend()
            )
        except Exception as e:
            raise Exception(f"加载私钥失败: {str(e)}")
    
    def generate_trial_license(self):
        """生成试用激活码"""
        license_data = {
            't': 'trial',  # type
            'v': LICENSE_VERSION,  # version
            'c': int(datetime.now().timestamp() * 1000),  # createdAt
            'e': int((datetime.now() + timedelta(days=7)).timestamp() * 1000),  # expireAt
            'm': '*'  # machineId
        }
        return license_data
    
    def generate_full_license(self, machine_id, days=None, is_permanent=False):
        """生成正式激活码"""
        license_data = {
            't': 'full',  # type
            'v': LICENSE_VERSION,  # version
            'm': machine_id,  # machineId
            'c': int(datetime.now().timestamp() * 1000),  # createdAt
            'e': None if is_permanent else int((datetime.now() + timedelta(days=days)).timestamp() * 1000),
            'p': is_permanent  # permanent
        }
        return license_data
    
    def encrypt_license_data(self, license_data):
        """使用RSA私钥加密数据"""
        if not self.private_key:
            raise Exception("私钥未加载")
        
        # 紧凑JSON编码
        json_str = json.dumps(license_data, separators=(',', ':'), ensure_ascii=False)
        data_buffer = json_str.encode('utf-8')
        
        # RSA签名
        signature = self.private_key.sign(
            data_buffer,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        # 组合格式：[4字节数据长度] + [数据] + [签名]
        length_buffer = struct.pack('>I', len(data_buffer))
        combined = length_buffer + data_buffer + signature
        
        # Base64编码
        base64_str = base64.b64encode(combined).decode('ascii')
        return base64_str
    
    def format_license_key(self, base64_key):
        """格式化激活码（添加分隔符）"""
        groups = []
        for i in range(0, len(base64_key), 5):
            groups.append(base64_key[i:i+5])
        return 'SPED-' + '-'.join(groups)


class LicenseGeneratorGUI(QMainWindow):
    """激活码生成工具GUI"""
    
    def __init__(self):
        super().__init__()
        self.settings = QSettings('SPEDSAFE', 'LicenseGenerator')
        self.generator = None
        self.history = []
        self.load_settings()
        self.init_ui()
        self.load_private_key()
    
    def init_ui(self):
        """初始化用户界面"""
        self.setWindowTitle(f'{APP_NAME} v{APP_VERSION}')
        self.setGeometry(100, 100, 1000, 700)
        
        # 设置样式
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f5f5f5;
            }
            QGroupBox {
                color: #333;
                font-weight: bold;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 3px 0 3px;
            }
            QPushButton {
                background-color: #FF9500;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 8px 15px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #FFB133;
            }
            QPushButton:pressed {
                background-color: #FF8000;
            }
            QLineEdit, QComboBox, QSpinBox, QDateEdit {
                padding: 5px;
                border: 1px solid #ddd;
                border-radius: 3px;
                background-color: white;
            }
            QLabel {
                color: #333;
            }
        """)
        
        # 标签页
        tabs = QTabWidget()
        tabs.addTab(self.create_generator_tab(), '📄 激活码生成')
        tabs.addTab(self.create_history_tab(), '📋 生成历史')
        tabs.addTab(self.create_settings_tab(), '⚙️ 设置')
        
        self.setCentralWidget(tabs)
    
    def create_generator_tab(self):
        """生成激活码标签页"""
        widget = QWidget()
        layout = QVBoxLayout()
        
        # 激活码类型选择
        type_group = QGroupBox('激活码类型')
        type_layout = QHBoxLayout()
        
        self.type_combo = QComboBox()
        self.type_combo.addItems(['试用码（7天）', '正式码（限期）', '永久码'])
        self.type_combo.currentIndexChanged.connect(self.on_type_changed)
        
        type_layout.addWidget(QLabel('选择类型:'))
        type_layout.addWidget(self.type_combo)
        type_layout.addStretch()
        type_group.setLayout(type_layout)
        
        layout.addWidget(type_group)
        
        # 机器码输入
        machine_group = QGroupBox('机器码')
        machine_layout = QHBoxLayout()
        
        machine_layout.addWidget(QLabel('机器码:'))
        self.machine_input = QLineEdit()
        self.machine_input.setPlaceholderText('输入或粘贴机器码，如：ABC123DEF456')
        self.machine_input.setEnabled(False)  # 试用码时禁用
        machine_layout.addWidget(self.machine_input)
        
        machine_group.setLayout(machine_layout)
        layout.addWidget(machine_group)
        
        # 有效期设置
        self.validity_group = QGroupBox('有效期设置')
        validity_layout = QHBoxLayout()
        
        validity_layout.addWidget(QLabel('有效期:'))
        self.days_spinbox = QSpinBox()
        self.days_spinbox.setMinimum(1)
        self.days_spinbox.setMaximum(3650)
        self.days_spinbox.setValue(365)
        validity_layout.addWidget(self.days_spinbox)
        validity_layout.addWidget(QLabel('天'))
        validity_layout.addStretch()
        
        # 显示过期时间
        validity_layout.addWidget(QLabel('过期时间:'))
        self.expire_label = QLabel()
        self.update_expire_date()
        self.days_spinbox.valueChanged.connect(self.update_expire_date)
        validity_layout.addWidget(self.expire_label)
        
        self.validity_group.setLayout(validity_layout)
        layout.addWidget(self.validity_group)
        
        # 生成按钮
        generate_btn = QPushButton('🔑 生成激活码')
        generate_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9500;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 12px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #FFB133;
            }
        """)
        generate_btn.clicked.connect(self.generate_license)
        layout.addWidget(generate_btn)
        
        # 激活码显示
        result_group = QGroupBox('生成的激活码')
        result_layout = QVBoxLayout()
        
        result_layout.addWidget(QLabel('激活码内容:'))
        self.result_text = QTextEdit()
        self.result_text.setReadOnly(True)
        self.result_text.setFont(QFont('Courier New', 10))
        self.result_text.setMinimumHeight(100)
        result_layout.addWidget(self.result_text)
        
        # 操作按钮
        btn_layout = QHBoxLayout()
        
        copy_btn = QPushButton('📋 复制激活码')
        copy_btn.clicked.connect(self.copy_to_clipboard)
        btn_layout.addWidget(copy_btn)
        
        copy_full_btn = QPushButton('📋 复制完整信息')
        copy_full_btn.clicked.connect(self.copy_full_info)
        btn_layout.addWidget(copy_full_btn)
        
        save_btn = QPushButton('💾 保存为文件')
        save_btn.clicked.connect(self.save_to_file)
        btn_layout.addWidget(save_btn)
        
        btn_layout.addStretch()
        result_layout.addLayout(btn_layout)
        
        result_group.setLayout(result_layout)
        layout.addWidget(result_group)
        
        layout.addStretch()
        widget.setLayout(layout)
        return widget
    
    def create_history_tab(self):
        """生成历史标签页"""
        widget = QWidget()
        layout = QVBoxLayout()
        
        # 历史记录表格
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(5)
        self.history_table.setHorizontalHeaderLabels(['类型', '机器码', '有效期', '生成时间', '激活码'])
        self.history_table.setColumnWidth(0, 80)
        self.history_table.setColumnWidth(1, 150)
        self.history_table.setColumnWidth(2, 100)
        self.history_table.setColumnWidth(3, 150)
        self.history_table.setColumnWidth(4, 250)
        
        layout.addWidget(self.history_table)
        
        # 操作按钮
        btn_layout = QHBoxLayout()
        
        refresh_btn = QPushButton('🔄 刷新')
        refresh_btn.clicked.connect(self.refresh_history)
        btn_layout.addWidget(refresh_btn)
        
        clear_btn = QPushButton('🗑️ 清空历史')
        clear_btn.clicked.connect(self.clear_history)
        btn_layout.addWidget(clear_btn)
        
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        widget.setLayout(layout)
        return widget
    
    def create_settings_tab(self):
        """设置标签页"""
        widget = QWidget()
        layout = QVBoxLayout()
        
        # 私钥文件设置
        key_group = QGroupBox('私钥管理')
        key_layout = QVBoxLayout()
        
        key_layout.addWidget(QLabel('私钥文件路径:'))
        key_path_layout = QHBoxLayout()
        self.key_path_input = QLineEdit()
        self.key_path_input.setReadOnly(True)
        self.key_path_input.setText(self.get_private_key_path())
        key_path_layout.addWidget(self.key_path_input)
        
        select_key_btn = QPushButton('📁 选择文件')
        select_key_btn.clicked.connect(self.select_private_key)
        key_path_layout.addWidget(select_key_btn)
        
        reload_btn = QPushButton('🔄 重新加载')
        reload_btn.clicked.connect(self.load_private_key)
        key_path_layout.addWidget(reload_btn)
        
        key_layout.addLayout(key_path_layout)
        
        self.key_status_label = QLabel('⏳ 正在加载私钥...')
        key_layout.addWidget(self.key_status_label)
        
        key_group.setLayout(key_layout)
        layout.addWidget(key_group)
        
        # 信息
        info_group = QGroupBox('关于')
        info_layout = QVBoxLayout()
        
        info_text = f"""
<b>特教安全教育资源仪 - 激活码生成工具</b><br/>
版本: {APP_VERSION}<br/>
<br/>
<b>功能:</b><br/>
• 生成试用激活码（7天）<br/>
• 生成限期激活码<br/>
• 生成永久激活码<br/>
• 激活码复制到剪贴板<br/>
• 激活码历史记录<br/>
<br/>
<b>加密方式:</b><br/>
• RSA-2048 签名<br/>
• SHA-256 哈希<br/>
• Base64 编码<br/>
<br/>
⚠️ 请妥善保管私钥文件，不要泄露！
        """
        
        info_label = QLabel(info_text)
        info_label.setWordWrap(True)
        info_layout.addWidget(info_label)
        
        info_group.setLayout(info_layout)
        layout.addWidget(info_group)
        
        layout.addStretch()
        widget.setLayout(layout)
        return widget
    
    def on_type_changed(self):
        """激活码类型改变时的处理"""
        type_idx = self.type_combo.currentIndex()
        
        if type_idx == 0:  # 试用码
            self.machine_input.setEnabled(False)
            self.validity_group.setEnabled(False)
        else:  # 正式码或永久码
            self.machine_input.setEnabled(True)
            self.validity_group.setEnabled(type_idx == 1)
    
    def update_expire_date(self):
        """更新过期日期显示"""
        days = self.days_spinbox.value()
        expire_date = datetime.now() + timedelta(days=days)
        self.expire_label.setText(expire_date.strftime('%Y年%m月%d日'))
    
    def get_private_key_path(self):
        """获取私钥文件路径"""
        return self.settings.value('private_key_path', str(Path(__file__).parent / '.keys' / 'private.pem'))
    
    def load_private_key(self):
        """加载私钥"""
        try:
            key_path = self.get_private_key_path()
            if not Path(key_path).exists():
                self.key_status_label.setText('❌ 私钥文件不存在')
                self.key_status_label.setStyleSheet('color: red;')
                return
            
            with open(key_path, 'r', encoding='utf-8') as f:
                private_key_pem = f.read()
            
            self.generator = LicenseGenerator(private_key_pem)
            self.key_status_label.setText('✅ 私钥已加载')
            self.key_status_label.setStyleSheet('color: green;')
            self.key_path_input.setText(key_path)
            
        except Exception as e:
            self.key_status_label.setText(f'❌ 加载私钥失败: {str(e)}')
            self.key_status_label.setStyleSheet('color: red;')
            QMessageBox.critical(self, '错误', f'加载私钥失败:\n{str(e)}')
    
    def select_private_key(self):
        """选择私钥文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            '选择私钥文件',
            str(Path.home()),
            'PEM Files (*.pem);;All Files (*)'
        )
        
        if file_path:
            self.settings.setValue('private_key_path', file_path)
            self.key_path_input.setText(file_path)
            self.load_private_key()
    
    def generate_license(self):
        """生成激活码"""
        if not self.generator:
            QMessageBox.warning(self, '错误', '私钥未加载，请先加载私钥')
            return
        
        try:
            type_idx = self.type_combo.currentIndex()
            
            if type_idx == 0:  # 试用码
                license_data = self.generator.generate_trial_license()
                license_type = '试用版'
                machine_id = '*'
                validity = '7天'
            elif type_idx == 1:  # 正式码（限期）
                machine_id = self.machine_input.text().strip().upper()
                if not machine_id:
                    QMessageBox.warning(self, '错误', '请输入机器码')
                    return
                
                days = self.days_spinbox.value()
                license_data = self.generator.generate_full_license(machine_id, days=days)
                license_type = '正式版'
                validity = f'{days}天'
            else:  # 永久码
                machine_id = self.machine_input.text().strip().upper()
                if not machine_id:
                    QMessageBox.warning(self, '错误', '请输入机器码')
                    return
                
                license_data = self.generator.generate_full_license(machine_id, is_permanent=True)
                license_type = '永久版'
                machine_id = self.machine_input.text().strip().upper()
                validity = '永久'
            
            # 加密并格式化
            encrypted = self.generator.encrypt_license_data(license_data)
            formatted = self.generator.format_license_key(encrypted)
            
            # 显示信息
            info_text = f"""激活码类型: {license_type}
机器码: {machine_id}
有效期: {validity}
创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

激活码:
{formatted}"""
            
            self.result_text.setText(info_text)
            
            # 保存到历史
            self.history.append({
                'type': license_type,
                'machine_id': machine_id,
                'validity': validity,
                'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'license_key': formatted
            })
            
            self.save_history()
            
            QMessageBox.information(self, '成功', '激活码已生成！')
            
        except Exception as e:
            QMessageBox.critical(self, '错误', f'生成激活码失败:\n{str(e)}')
    
    def copy_to_clipboard(self):
        """复制激活码到剪贴板"""
        text = self.result_text.toPlainText()
        if not text:
            QMessageBox.warning(self, '提示', '没有可复制的激活码')
            return
        
        # 只复制激活码部分
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('SPED-'):
                pyperclip.copy(line.strip())
                QMessageBox.information(self, '成功', '激活码已复制到剪贴板')
                return
        
        QMessageBox.warning(self, '错误', '未找到有效的激活码')
    
    def copy_full_info(self):
        """复制完整信息到剪贴板"""
        text = self.result_text.toPlainText()
        if not text:
            QMessageBox.warning(self, '提示', '没有可复制的信息')
            return
        
        pyperclip.copy(text)
        QMessageBox.information(self, '成功', '完整信息已复制到剪贴板')
    
    def save_to_file(self):
        """保存激活码信息到文件"""
        text = self.result_text.toPlainText()
        if not text:
            QMessageBox.warning(self, '提示', '没有可保存的内容')
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            '保存激活码信息',
            str(Path.home() / f'license_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'),
            'Text Files (*.txt);;All Files (*)'
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(text)
                QMessageBox.information(self, '成功', f'已保存到:\n{file_path}')
            except Exception as e:
                QMessageBox.critical(self, '错误', f'保存文件失败:\n{str(e)}')
    
    def refresh_history(self):
        """刷新历史记录表格"""
        self.history_table.setRowCount(0)
        
        for i, record in enumerate(reversed(self.history)):
            self.history_table.insertRow(i)
            self.history_table.setItem(i, 0, QTableWidgetItem(record['type']))
            self.history_table.setItem(i, 1, QTableWidgetItem(record['machine_id']))
            self.history_table.setItem(i, 2, QTableWidgetItem(record['validity']))
            self.history_table.setItem(i, 3, QTableWidgetItem(record['created_at']))
            self.history_table.setItem(i, 4, QTableWidgetItem(record['license_key']))
    
    def clear_history(self):
        """清空历史记录"""
        reply = QMessageBox.question(
            self,
            '确认',
            '确定要清空所有历史记录吗？',
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.history.clear()
            self.save_history()
            self.refresh_history()
            QMessageBox.information(self, '成功', '历史记录已清空')
    
    def save_history(self):
        """保存历史记录到设置"""
        history_json = json.dumps(self.history, ensure_ascii=False, indent=2)
        self.settings.setValue('history', history_json)
    
    def load_settings(self):
        """加载设置和历史记录"""
        try:
            history_json = self.settings.value('history', '[]')
            self.history = json.loads(history_json)
        except:
            self.history = []


def main():
    """主函数"""
    app = QApplication(sys.argv)
    
    # 设置应用信息
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    
    # 创建主窗口
    window = LicenseGeneratorGUI()
    window.show()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
