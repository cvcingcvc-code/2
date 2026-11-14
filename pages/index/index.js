const { listActivities, listCoverPaths, getSignedUrl } = require('../../utils/api');

Page({
    data: {
        viewState: 'loading',
        errorMsg: '',
        activities: [],
        activeCount: 0,
        signedIn: false,
        sessionChecked: false,
    },

    onShow() {
        this.restore();
    },

    async restore() {
        this.setData({ viewState: 'loading', errorMsg: '' });
        const session = await getApp().ensureSession();
        const signedIn = !!(session && session.data);
        this.setData({ signedIn, sessionChecked: true });
        const loaded = await this.loadActivities();
        if (loaded && signedIn) {
            await this.loadCovers();
        }
    },

    async loadActivities() {
        const result = await listActivities();
        if (result.error) {
            this.setData({ viewState: 'error', errorMsg: result.error.message });
            return false;
        }
        const activities = result.data;
        const activeCount = activities.filter(item => item.status === 'open').length;
        this.setData({
            activities,
            activeCount,
            viewState: activities.length === 0 ? 'empty' : 'ready',
        });
        return true;
    },

    async loadCovers() {
        const result = await listCoverPaths();
        if (result.error) return;
        const paths = result.data;
        const keys = Object.keys(paths);
        const patch = {};
        for (let i = 0; i < keys.length; i += 1) {
            const activityId = keys[i];
            const index = this.data.activities.findIndex(
                item => String(item.id) === String(activityId),
            );
            if (index < 0) continue;
            const signed = await getSignedUrl(paths[activityId]);
            if (signed.data) {
                patch['activities[' + index + '].coverUrl'] = signed.data;
            }
        }
        if (Object.keys(patch).length > 0) {
            this.setData(patch);
        }
    },

    onSignedIn() {
        getApp().resetSession();
        this.restore();
    },

    handleRetry() {
        this.restore();
    },

    onPullDownRefresh() {
        this.restore().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
    },

    goDetail(event) {
        const id = event.currentTarget.dataset.id;
        wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
    },

    goRecords() {
        wx.switchTab({ url: '/pages/records/records' });
    },
});
