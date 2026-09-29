# huangguo-fongmi

黄果短剧的 FongMi / 影视TV QuickJS Spider 适配项目。原始 XPTV 源来自 [Yswag/xptv-extensions 的 huangguo.js](https://github.com/Yswag/xptv-extensions/blob/main/js/huangguo.js)。

## 文件

- `huangguo_fongmi.js`：视频源脚本。
- `huangguo_fongmi_config.json`：单站点配置示例。

## 使用

打开 [`huangguo_fongmi_config.json`](./huangguo_fongmi_config.json)，点击 **Raw** 并复制其地址。在支持 QuickJS Spider 的 FongMi / 影视TV 客户端中导入这个配置地址。配置内的 `api` 已指向仓库中的脚本绝对地址。

目前仅完成脚本语法和 JSON 格式检查，尚未在安卓客户端实测。网站接口与页面结构发生变化时，源可能需要更新。
