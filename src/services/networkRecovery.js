// 判断请求失败是否源于后端暂时不可用。
// 这里只负责分类错误，供认证等调用方决定如何保留页面状态；
// 不再全局中断请求、探测后端或刷新页面，以免调试断点导致状态丢失。
export const isBackendUnavailableError = (error) => {
    if (!error || error.code === 'ERR_CANCELED') return false

    const status = error.response?.status

    return error.code === 'ERR_NETWORK'
        || error.code === 'ECONNABORTED'
        || error.code === 'ETIMEDOUT'
        || (status >= 500 && status <= 599)
        || !error.response
}

// 保留原有入口，避免调用方因为网络恢复策略调整而需要同步修改。
// 请求的超时与失败处理应由具体业务自行决定。
export const installNetworkRecovery = () => {}
