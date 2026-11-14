// 业务数据访问层：页面只调用这里的方法，不直接拼云数据库查询。
const { cloud } = require('./cloud');
const { createTableAccess } = require('./workbuddy-data-access');
const { formatDate, formatFullDate, formatDateTime, weekday, splitLines } = require('./format');

function toMessage(error, fallback) {
    if (error && typeof error.message === 'string' && error.message !== '') {
        return error.message;
    }
    return fallback;
}

function mapActivity(row) {
    return {
        id: row.id,
        title: row.title || '',
        audience: row.audience || '',
        summary: row.summary || '',
        description: row.description || '',
        descriptionLines: splitLines(row.description),
        eventDate: row.event_date || '',
        dateLabel: formatDate(row.event_date),
        fullDateLabel: formatFullDate(row.event_date),
        weekday: weekday(row.event_date),
        eventTime: row.event_time || '',
        location: row.location || '',
        capacity: Number(row.capacity) || 0,
        tag: row.tag || '活动',
        status: row.status || 'open',
        statusText: row.status === 'open' ? '报名中' : '已结束',
        coverUrl: '',
    };
}

function mapRegistration(row) {
    return {
        id: row.id,
        activityId: row.activity_id,
        name: row.name || '',
        phone: row.phone || '',
        partySize: Number(row.party_size) || 1,
        remark: row.remark || '',
        status: row.status || 'registered',
        statusText: row.status === 'cancelled' ? '已取消' : '报名成功',
        isActive: row.status !== 'cancelled',
        createdAt: formatDateTime(row.created_at),
        title: '',
        dateLabel: '',
        eventTime: '',
        location: '',
    };
}

const activityColumns = [
    'id', 'title', 'audience', 'summary', 'description', 'event_date', 'event_time',
    'location', 'capacity', 'tag', 'sort_order', 'status', 'created_at',
];

const registrationColumns = [
    'id', 'owner_name', 'activity_id', 'name', 'phone', 'party_size',
    'remark', 'status', 'created_at',
];

const imageColumns = ['id', 'activity_id', 'path', 'created_at'];

const activityStore = createTableAccess(cloud, {
    table: 'activities',
    columns: activityColumns,
    fromRow: mapActivity,
    orderBy: { column: 'sort_order', ascending: true },
});

const registrationStore = createTableAccess(cloud, {
    table: 'registrations',
    columns: registrationColumns,
    fromRow: mapRegistration,
    toRow(payload) {
        const row = {};
        const source = payload || {};
        if (source.activity_id !== undefined) row.activity_id = source.activity_id;
        if (source.owner_name !== undefined) row.owner_name = source.owner_name;
        if (source.name !== undefined) row.name = source.name;
        if (source.phone !== undefined) row.phone = source.phone;
        if (source.party_size !== undefined) row.party_size = source.party_size;
        if (source.remark !== undefined) row.remark = source.remark;
        if (source.status !== undefined) row.status = source.status;
        return row;
    },
    orderBy: { column: 'created_at', ascending: false },
});

const imageStore = createTableAccess(cloud, {
    table: 'activity_images',
    columns: imageColumns,
    toRow(payload) {
        const row = {};
        const source = payload || {};
        if (source.activity_id !== undefined) row.activity_id = source.activity_id;
        if (source.path !== undefined) row.path = source.path;
        return row;
    },
    orderBy: { column: 'created_at', ascending: false },
});

async function listActivities() {
    const result = await activityStore.list();
    if (result.error) {
        return { data: [], error: { message: toMessage(result.error, '活动列表加载失败') } };
    }
    return { data: result.data || [], error: null };
}

async function findActivity(id) {
    const result = await listActivities();
    if (result.error) return { data: null, error: result.error };
    const found = result.data.filter(item => String(item.id) === String(id))[0];
    return { data: found || null, error: null };
}

// 报名记录只属于当前登录用户，行的可见性由数据库 RLS 保证。
async function listRegistrations() {
    const result = await registrationStore.list();
    if (result.error) {
        return { data: [], error: { message: toMessage(result.error, '报名记录加载失败') } };
    }
    return { data: result.data || [], error: null };
}

async function hasActiveRegistration(activityId) {
    try {
        const result = await cloud.database
            .from('registrations')
            .select('id')
            .eq('activity_id', activityId)
            .eq('status', 'registered')
            .limit(1);
        if (result.error) {
            return { data: false, error: { message: toMessage(result.error, '报名状态查询失败') } };
        }
        return { data: Array.isArray(result.data) && result.data.length > 0, error: null };
    } catch (error) {
        return { data: false, error: { message: toMessage(error, '报名状态查询失败') } };
    }
}

async function createRegistration(payload) {
    const result = await registrationStore.create(payload);
    if (result.error) {
        const code = result.error.code;
        if (code === '23505') {
            return { data: null, error: { message: '你已报名该活动，可在报名记录中查看' } };
        }
        return { data: null, error: { message: toMessage(result.error, '报名提交失败，请稍后重试') } };
    }
    return { data: result.data, error: null };
}

async function cancelRegistration(id) {
    const result = await registrationStore.update(id, { status: 'cancelled' });
    if (result.error) {
        return { data: null, error: { message: toMessage(result.error, '取消报名失败，请稍后重试') } };
    }
    return { data: result.data, error: null };
}

// 活动封面：图片文件保存在云端存储 shared 目录，对象路径存在 activity_images 表。
async function listCoverPaths() {
    const result = await imageStore.list();
    if (result.error) {
        return { data: {}, error: { message: toMessage(result.error, '活动图片加载失败') } };
    }
    const map = {};
    const rows = result.data || [];
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row && row.activity_id && row.path && !map[row.activity_id]) {
            map[row.activity_id] = row.path;
        }
    }
    return { data: map, error: null };
}

async function getSignedUrl(path) {
    try {
        const result = await cloud.storage.createSignedUrl(path, 600);
        if (result.error) {
            return { data: '', error: { message: toMessage(result.error, '图片地址获取失败') } };
        }
        const url = result.data && result.data.signedUrl ? result.data.signedUrl : '';
        return { data: url, error: url ? null : { message: '图片地址获取失败' } };
    } catch (error) {
        return { data: '', error: { message: toMessage(error, '图片地址获取失败') } };
    }
}

function readArrayBuffer(filePath) {
    return new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
            filePath,
            success: response => resolve(response.data),
            fail: error => reject(new Error((error && error.errMsg) || '读取图片失败')),
        });
    });
}

async function uploadCover(activityId, tempFilePath, contentType, extension, userId) {
    try {
        const body = await readArrayBuffer(tempFilePath);
        const path = cloud.storage.sharedPath(
            userId,
            'activity-covers/' + activityId + '-' + Date.now() + '.' + extension,
        );
        const uploaded = await cloud.storage.upload(path, body, {
            contentType,
            upsert: false,
            metadata: { purpose: 'activity-cover' },
        });
        if (uploaded.error) {
            return { data: null, error: { message: toMessage(uploaded.error, '图片上传失败') } };
        }
        const created = await imageStore.create({ activity_id: activityId, path });
        if (created.error) {
            await cloud.storage.remove([path]);
            return { data: null, error: { message: toMessage(created.error, '图片记录保存失败') } };
        }
        const signed = await getSignedUrl(path);
        return { data: { path, url: signed.data }, error: signed.error };
    } catch (error) {
        return { data: null, error: { message: toMessage(error, '图片上传失败') } };
    }
}

module.exports = {
    toMessage,
    listActivities,
    findActivity,
    listRegistrations,
    hasActiveRegistration,
    createRegistration,
    cancelRegistration,
    listCoverPaths,
    getSignedUrl,
    uploadCover,
};
