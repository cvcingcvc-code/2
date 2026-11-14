const { cloud } = require('../../utils/cloud');
const { listActivities, listRegistrations, cancelRegistration } = require('../../utils/api');

Page({
    data: {
        authState: 'checking',
        viewState: 'loading',
        errorMsg: '',
        records: [],
        stats: { total: 0, active: 0, cancelled: 0 },
        cancellingId: null,
    },

    onShow() {
        this.restore();
    },

    async restore() {
        this.setData({ authState: 'checking', viewState: 'loading', errorMsg: '' });
        const session = await getApp().ensureSession();
        if (!session.data) {
            this.setData({ authState: 'signed-out', viewState: 'ready', records: [] });
            return;
        }
        await this.loadRecords();
    },

    async loadRecords() {
        const activitiesResult = listActivities();
        const registrationsResult = listRegistrations();
        const activities = await activitiesResult;
        const registrations = await registrationsResult;
        if (registrations.error) {
            this.setData({
                authState: 'signed-in',
                viewState: 'error',
                errorMsg: registrations.error.message,
            });
            return;
        }

        const activityMap = {};
        const activityRows = activities.error ? [] : activities.data;
        for (let i = 0; i < activityRows.length; i += 1) {
            activityMap[String(activityRows[i].id)] = activityRows[i];
        }

        const rows = registrations.data;
        const records = rows.map(row => {
            const activity = activityMap[String(row.activityId)];
            return Object.assign({}, row, {
                title: activity ? activity.title : '活动已下线',
                dateLabel: activity ? activity.dateLabel : '',
                eventTime: activity ? activity.eventTime : '',
                location: activity ? activity.location : '',
            });
        });

        const active = records.filter(item => item.isActive).length;
        this.setData({
            authState: 'signed-in',
            viewState: records.length === 0 ? 'empty' : 'ready',
            records,
            stats: { total: records.length, active, cancelled: records.length - active },
        });
    },

    onSignedIn() {
        getApp().resetSession();
        this.restore();
    },

    async handleSignOut() {
        const result = await cloud.auth.signOut();
        if (result && result.error) {
            wx.showToast({ title: result.error.message || '退出失败，请重试', icon: 'none' });
            return;
        }
        getApp().resetSession();
        this.restore();
    },

    handleCancel(event) {
        const id = event.currentTarget.dataset.id;
        wx.showModal({
            title: '取消报名',
            content: '确定要取消这场活动的报名吗？取消后仍可重新报名。',
            confirmText: '确认取消',
            cancelText: '再想想',
            success: response => {
                if (response.confirm) this.performCancel(id);
            },
        });
    },

    async performCancel(id) {
        if (this.data.cancellingId) return;
        this.setData({ cancellingId: id });
        const result = await cancelRegistration(id);
        this.setData({ cancellingId: null });
        if (result.error) {
            wx.showToast({ title: result.error.message, icon: 'none' });
            return;
        }
        wx.showToast({ title: '已取消报名', icon: 'none' });
        await this.loadRecords();
    },

    goDetail(event) {
        const id = event.currentTarget.dataset.activityId;
        wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
    },

    goHome() {
        wx.switchTab({ url: '/pages/index/index' });
    },

    handleRetry() {
        this.restore();
    },

    onPullDownRefresh() {
        this.restore().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
    },
});
