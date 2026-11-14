const { cloud } = require('../../utils/cloud');

Component({
    properties: {
        hint: {
            type: String,
            value: '登录后即可报名并查看报名记录',
        },
    },

    data: {
        loggingIn: false,
        loginError: '',
    },

    methods: {
        handleLogin() {
            if (this.data.loggingIn) return;
            this.setData({ loggingIn: true, loginError: '' });
            wx.login({
                success: response => {
                    this.completeLogin(response.code);
                },
                fail: error => {
                    console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
                        stage: 'wx.login',
                        message: (error && error.errMsg) || '微信登录未成功',
                    }));
                    this.setData({
                        loggingIn: false,
                        loginError: '微信登录未成功，请在微信中重试',
                    });
                },
            });
        },

        async completeLogin(code) {
            let appid = '';
            try {
                appid = wx.getAccountInfoSync().miniProgram.appId;
            } catch (error) {
                console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
                    stage: 'getAccountInfoSync',
                    message: (error && error.message) || '无法读取当前小程序 appid',
                }));
                this.setData({ loggingIn: false, loginError: '当前环境不支持微信登录，请在微信客户端打开' });
                return;
            }

            try {
                const result = await cloud.auth.signInWithWechat(code, appid);
                if (result.error) {
                    this.setData({
                        loggingIn: false,
                        loginError: result.error.message || '微信登录失败，请重试',
                    });
                    return;
                }
                if (!result.data) {
                    this.setData({ loggingIn: false, loginError: '未获取到登录会话，请重试' });
                    return;
                }
                getApp().resetSession();
                this.setData({ loggingIn: false, loginError: '' });
                this.triggerEvent('signedin', {});
            } catch (error) {
                console.error('[WorkBuddy Cloud] login failed', JSON.stringify({
                    stage: 'wechat-login-handler',
                    message: (error && error.message) || '微信登录失败，请重试',
                }));
                this.setData({ loggingIn: false, loginError: '微信登录失败，请重试' });
            }
        },
    },
});
