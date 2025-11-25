#!/usr/bin/env python3
"""
激活码生成工具 - 命令行版本
用于快速测试和生成激活码
"""

import sys
import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
import struct
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend

# 常量
LICENSE_VERSION = '1.0'
RSA_KEY_SIZE = 2048


class LicenseGenerator:
    """激活码加密生成器"""
    
    def __init__(self, private_key_pem=None):
        self.private_key = None
        if private_key_pem:
            self.load_private_key(private_key_pem)
    
    def load_private_key(self, private_key_pem):
        """加载RSA私钥"""
        try:
            if isinstance(private_key_pem, str):
                private_key_pem = private_key_pem.encode()
            
            self.private_key = serialization.load_pem_private_key(
                private_key_pem,
                password=None,
                backend=default_backend()
            )
            print("✓ 私钥已加载")
        except Exception as e:
            raise Exception(f"加载私钥失败: {str(e)}")
    
    def generate_trial_license(self):
        """生成试用激活码"""
        license_data = {
            't': 'trial',
            'v': LICENSE_VERSION,
            'c': int(datetime.now().timestamp() * 1000),
            'e': int((datetime.now() + timedelta(days=7)).timestamp() * 1000),
            'm': '*'
        }
        return license_data
    
    def generate_full_license(self, machine_id, days=None, is_permanent=False):
        """生成正式激活码"""
        license_data = {
            't': 'full',
            'v': LICENSE_VERSION,
            'm': machine_id,
            'c': int(datetime.now().timestamp() * 1000),
            'e': None if is_permanent else int((datetime.now() + timedelta(days=days)).timestamp() * 1000),
            'p': is_permanent
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
        """格式化激活码"""
        groups = []
        for i in range(0, len(base64_key), 5):
            groups.append(base64_key[i:i+5])
        return 'SPED-' + '-'.join(groups)


def main():
    parser = argparse.ArgumentParser(
        description='特教安全教育资源仪 - 激活码生成工具 (Python版)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 生成试用码
  python license_generator_cli.py --trial

  # 生成正式码（365天）
  python license_generator_cli.py --machine ABC123DEF456 --days 365

  # 生成永久码
  python license_generator_cli.py --machine ABC123DEF456 --permanent

  # 指定私钥文件
  python license_generator_cli.py --machine ABC123DEF456 --days 365 --key /path/to/private.pem
        """
    )
    
    parser.add_argument('--trial', action='store_true', help='生成7天试用码')
    parser.add_argument('--machine', type=str, help='机器码（正式码必需）')
    parser.add_argument('--days', type=int, help='有效期（天数）')
    parser.add_argument('--permanent', action='store_true', help='生成永久激活码')
    parser.add_argument('--key', type=str, help='私钥文件路径（默认：.keys/private.pem）')
    parser.add_argument('--output', type=str, help='输出文件路径')
    
    args = parser.parse_args()
    
    # 获取私钥文件路径
    if args.key:
        key_path = Path(args.key)
    else:
        key_path = Path(__file__).parent / '.keys' / 'private.pem'
    
    # 检查私钥文件
    if not key_path.exists():
        print(f"❌ 错误: 私钥文件不存在: {key_path}")
        print("\n请确保私钥文件存在，或使用 --key 参数指定私钥文件路径")
        sys.exit(1)
    
    # 加载私钥
    try:
        with open(key_path, 'r', encoding='utf-8') as f:
            private_key_pem = f.read()
        
        generator = LicenseGenerator(private_key_pem)
    except Exception as e:
        print(f"❌ 加载私钥失败: {str(e)}")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    
    try:
        # 生成试用码
        if args.trial:
            print("🎯 生成试用激活码...\n")
            license_data = generator.generate_trial_license()
            license_type = '试用版'
            machine_id = '*'
            validity = '7天'
            
        # 生成正式码或永久码
        elif args.machine:
            machine_id = args.machine.strip().upper()
            
            if args.permanent:
                print("🎯 生成永久激活码...\n")
                license_data = generator.generate_full_license(machine_id, is_permanent=True)
                license_type = '永久版'
                validity = '永久'
            else:
                if not args.days:
                    print("❌ 错误: 缺少 --days 或 --permanent 参数")
                    sys.exit(1)
                
                if args.days <= 0:
                    print("❌ 错误: --days 必须是正整数")
                    sys.exit(1)
                
                print(f"🎯 生成{args.days}天激活码...\n")
                license_data = generator.generate_full_license(machine_id, days=args.days)
                license_type = '正式版'
                validity = f'{args.days}天'
        else:
            print("❌ 错误: 必须指定 --trial 或 --machine 参数")
            parser.print_help()
            sys.exit(1)
        
        # 加密并格式化
        encrypted = generator.encrypt_license_data(license_data)
        formatted = generator.format_license_key(encrypted)
        
        # 输出信息
        print("📄 激活码信息：")
        print(f"   类型: {license_type}")
        print(f"   机器码: {machine_id}")
        print(f"   有效期: {validity}")
        print(f"   创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   功能: 全功能")
        print("\n🔑 激活码：")
        print(f"\n   {formatted}\n")
        
        # 保存到文件
        if args.output:
            output_path = Path(args.output)
        else:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            if args.trial:
                output_path = Path(f'trial_license_{timestamp}.txt')
            else:
                output_path = Path(f'license_{machine_id[:8]}_{timestamp}.txt')
        
        content = f"""激活码类型: {license_type}
机器码: {machine_id}
有效期: {validity}
创建时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

激活码:
{formatted}
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"💾 已保存到文件: {output_path}")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"❌ 错误: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
