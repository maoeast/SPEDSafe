"""验证 docx：zip 完整性、media 图片数量、document.xml 合法性、标题与章节抽查。"""
import zipfile, re, sys, xml.etree.ElementTree as ET

path = r"docs\特教安全教育资源仪-用户操作手册.docx"
z = zipfile.ZipFile(path)
bad = z.testzip()
if bad:
    print("❌ zip 损坏:", bad)
    sys.exit(1)

media = [n for n in z.namelist() if n.startswith("word/media/")]
print("✅ zip 完整，条目数:", len(z.namelist()))
print("✅ 图片数量:", len(media))

xml = z.read("word/document.xml")
try:
    root = ET.fromstring(xml)
    print("✅ document.xml XML 合法")
except ET.ParseError as e:
    print("❌ document.xml 解析失败:", e)
    sys.exit(1)

ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
texts = [t.text or "" for t in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")]
full = "".join(texts)

# 抽查关键内容
checks = [
    "特教安全教育资源仪 · 用户操作手册",
    "1. 软件简介", "2. 启动与主界面", "3. 浏览与播放学习资源",
    "4. 学习中心", "5. 应用设置（需管理员）", "6. 儿童安全小助手",
    "7. 常见问题", "8. 附录",
    "校园安全", "居家安全", "社区安全", "个人安全", "安全演习", "安全课程", "安全互动",
    "295 个学习资源", "213 个安全教育视频", "82 个 H5 互动课件",
    "初学者", "好学生", "学霸", "十小时达人",
    "清除记录", "应用设置", "儿童安全小助手", "去配置",
    "deepseek-v4-flash-ga-260731", "120（医疗急救）", "119（火警）", "110（报警）",
    "管理员密码", "1MB", "保存设置",
    "紧急情况", "不能替代成年人现场监护",
]
missing = [c for c in checks if c not in full]
print("✅ 关键内容抽查:", "全部通过" if not missing else f"缺失 {missing}")

# 占位注释不应出现在 Word 文档中
if "<!--" in full:
    print("❌ 文档中仍含有 HTML 注释占位符")
    sys.exit(1)
print("✅ 无 HTML 注释占位符残留")

# 图片引用检查（drawing/blip 数量）
blips = len(re.findall(r'r:embed=', xml.decode("utf-8", "ignore")))
print("✅ document.xml 内嵌图片引用数:", blips)

# 表格数量
tables = list(root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl"))
print("✅ 表格数量:", len(tables))
