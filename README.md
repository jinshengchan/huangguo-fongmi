# huangguo-fongmi

黄果短剧的 FongMi / 影视TV QuickJS Spider 适配项目。原始 XPTV 源来自 [Yswag/xptv-extensions 的 huangguo.js](https://github.com/Yswag/xptv-extensions/blob/main/js/huangguo.js)。

## 文件

- `huangguo_fongmi.js`：视频源脚本。
- `huangguo_fongmi_config.json`：单站点配置示例。

## 使用

文件提交后，在支持 QuickJS Spider 的 FongMi / 影视TV 客户端中导入配置文件的 Raw 地址。配置中的 `api` 指向同目录的脚本文件；若客户端不支持相对地址，可改为脚本的 Raw 地址。

目前仅完成脚本语法和 JSON 格式检查，尚未在安卓客户端实测。网站接口与页面结构发生变化时，源可能需要更新。
