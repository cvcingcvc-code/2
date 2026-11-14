const { cloud } = require('./utils/cloud');

App({
    globalData: {
        appName: '活动报名',
    },

    ensureSession() {
        if (!this.sessionPromise) {
            this.sessionPromise = cloud.auth.getSession().then(
                result => result,
                error => ({
                    data: null,
                    error: { message: (error && error.message) || '登录状态获取失败' },
                }),
            );
        }
        return this.sessionPromise;
    },

    resetSession() {
        this.sessionPromise = null;
    },
});
