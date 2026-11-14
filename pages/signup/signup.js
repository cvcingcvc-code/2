const { findActivity, hasActiveRegistration, createRegistration } = require('../../utils/api');

Page({
    data: {
        id: '',
        authState: 'checking',
        loadError: '',
        activity: null,
        name: '',
        phone: '',
        partyOptions: [1, 2, 3, 4],
        partyIndex: 0,
        partySize: 1,
        remark: '',
        fieldErrors: { name: '', phone: '', remark: '' },
        formError: '',
        submitting: false,
        success: false,
        successName: '',
        successPhone: '',
        successPartySize: 1,
    },

    onLoad(options) {
        this.setData({ id: (options && options.id) || '' });
    },

    onShow() {
        this.restore();
    },

    async restore() {
        this.setData({ authState: 'checking', loadError: '' });
        const session = getApp().ensureSession();
        const activityResult = await findActivity(this.data.id);
        const sessionResult = await session;
        if (activityResult.error) {
            this.setData({ authState: 'error', loadError: activityResult.error.message });
            return;
        }
        if (!activityResult.data) {
            this.setData({ authState: 'error', loadError: '活动不存在或已下线' });
            return;
        }
        const signedIn = !!(sessionResult && sessionResult.data);
        this.setData({
            activity: activityResult.data,
            authState: signedIn ? 'signed-in' : 'signed-out',
        });
    },

    onSignedIn() {
        getApp().resetSession();
        this.restore();
    },

    handleInput(event) {
        const field = event.currentTarget.dataset.field;
        if (!field) return;
        const patch = {};
        patch[field] = event.detail.value;
        patch['fieldErrors.' + field] = '';
        patch.formError = '';
        this.setData(patch);
    },

    handlePartyChange(event) {
        const index = Number(event.detail.value) || 0;
        this.setData({ partyIndex: index, partySize: this.data.partyOptions[index] });
    },

    validate() {
        const errors = { name: '', phone: '', remark: '' };
        const name = this.data.name.trim();
        const phone = this.data.phone.trim();
        if (name === '') {
            errors.name = '请输入姓名';
        } else if (name.length < 2) {
            errors.name = '姓名至少 2 个字';
        }
        if (phone === '') {
            errors.phone = '请输入手机号';
        } else if (!/^1\d{10}$/.test(phone)) {
            errors.phone = '请输入正确的 11 位手机号';
        }
        const summary = errors.name || errors.phone || '';
        return { valid: summary === '', summary, errors };
    },

    async handleSubmit() {
        if (this.data.submitting) return;
        const validation = this.validate();
        if (!validation.valid) {
            this.setData({ formError: validation.summary, fieldErrors: validation.errors });
            return;
        }

        this.setData({
            submitting: true,
            formError: '',
            fieldErrors: { name: '', phone: '', remark: '' },
        });

        const session = await getApp().ensureSession();
        if (!session.data) {
            this.setData({ submitting: false, authState: 'signed-out' });
            return;
        }

        const duplicate = await hasActiveRegistration(this.data.activity.id);
        if (duplicate.error) {
            this.fail(duplicate.error.message);
            return;
        }
        if (duplicate.data) {
            this.fail('你已报名该活动，可在报名记录中查看');
            return;
        }

        const user = session.data.user || {};
        const name = this.data.name.trim();
        const phone = this.data.phone.trim();
        const result = await createRegistration({
            activity_id: this.data.activity.id,
            owner_name: user.name ? user.name : null,
            name,
            phone,
            party_size: this.data.partySize,
            remark: this.data.remark.trim(),
        });
        if (result.error) {
            this.fail(result.error.message);
            return;
        }

        this.setData({
            success: true,
            submitting: false,
            successName: name,
            successPhone: phone,
            successPartySize: this.data.partySize,
        });
    },

    fail(message) {
        this.setData({ formError: message, submitting: false });
    },

    goRecords() {
        wx.switchTab({ url: '/pages/records/records' });
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
