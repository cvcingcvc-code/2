// 应用公开配置，来自云服务开通结果 publicConfig。
// 这里只保存可下发的公开值；任何长期密钥都不进入小程序代码。
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');

const publicConfig = {
    endpoint: 'https://mp-api.app.workbuddy.host',
    publishableKey: 'wbpk_w9eiltvF78S72q3CM8wf9J_tzV6ktEHJyop13Ak6VIFa9L9t846uyT3',
};

const cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    wx: createDiagnosticWx(wx),
});

module.exports = { cloud };
