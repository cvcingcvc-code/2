const { findActivity, listCoverPaths, getSignedUrl, hasActiveRegistration, uploadCover } = require('../../utils/api');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

Page({
    data: {
        id: '',
        viewState: 'loading',
        errorMsg: '',
        activity: null,
        signedIn: false,
        hasRegistered: false,
        uploading: false,
    },

    onLoad(options) {
        this.setData({ id: (options && options.id) || '' });
    },

    onShow() {
        this.restore();
    },

    async restore() {
        this.setData({ viewState: 'loading', errorMsg: '' });
        const session = await getApp().ensureSession();
        const signedIn = !!(session && session.data);
        const result = await findActivity(this.data.id);
        if (result.error) {
            this.setData({ viewState: 'error', errorMsg: result.error.message });
            return;
        }
        if (!result.data) {
            this.setData({ viewState: 'empty' });
            return;
        }
        this.setData({ viewState: 'ready', activity: result.data, signedIn });
        if (signedIn) {
            await this.checkRegistration();
            await this.loadCover();
        }
    },

    async checkRegistration() {
        const result = await hasActiveRegistration(this.data.activity.id);
        if (!result.error) {
            this.setData({ hasRegistered: result.data });
        }
    },

    async loadCover() {
        const covers = await listCoverPaths();
        if (covers.error) return;
        const path = covers.data[String(this.data.activity.id)];
        if (!path) return;
        const signed = await getSignedUrl(path);
        if (signed.data) {
            this.setData({ 'activity.coverUrl': signed.data });
        }
    },

    chooseCover() {
        if (!this.data.signedIn) {
            wx.showToast({ title: '请先登录后设置封面', icon: 'none' });
            return;
        }
        if (this.data.uploading) return;
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album'],
            sizeType: ['compressed'],
            success: response => this.handleChosenImage(response),
            fail: error => {
                const message = (error && error.errMsg) || '';
                if (message.indexOf('cancel') < 0) {
                    wx.showToast({ title: '选择图片失败', icon: 'none' });
                }
            },
        });
    },

    async handleChosenImage(response) {
        const file = response.tempFiles && response.tempFiles[0];
        if (!file || !file.tempFilePath) {
            wx.showToast({ title: '未获取到图片', icon: 'none' });
            return;
        }
        if (file.size && file.size > MAX_IMAGE_SIZE) {
            wx.showToast({ title: '图片不能超过 5MB', icon: 'none' });
            return;
        }
        const match = /\.(png|jpg|jpeg|webp)$/i.exec(file.tempFilePath);
        const rawExt = match ? match[1].toLowerCase() : 'jpg';
        const extension = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const contentType = extension === 'png' ? 'image/png'
            : extension === 'webp' ? 'image/webp' : 'image/jpeg';

        const session = await getApp().ensureSession();
        if (!session.data || !session.data.user || !session.data.user.id) {
            wx.showToast({ title: '请先登录后上传', icon: 'none' });
            return;
        }

        this.setData({ uploading: true });
        const result = await uploadCover(
            this.data.activity.id,
            file.tempFilePath,
            contentType,
            extension,
            session.data.user.id,
        );
        this.setData({ uploading: false });
        if (result.error) {
            wx.showToast({ title: result.error.message, icon: 'none' });
            return;
        }
        if (result.data && result.data.url) {
            this.setData({ 'activity.coverUrl': result.data.url });
        }
        wx.showToast({ title: '封面已保存到云端', icon: 'none' });
    },

    goSignup() {
        wx.navigateTo({ url: '/pages/signup/signup?id=' + this.data.id });
    },

    goRecords() {
        wx.switchTab({ url: '/pages/records/records' });
    },

    handleRetry() {
        this.restore();
    },

    onPullDownRefresh() {
        this.restore().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
    },
});
