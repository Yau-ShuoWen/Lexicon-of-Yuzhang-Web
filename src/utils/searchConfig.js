// utils/searchConfig.js
export const STORAGE_KEY = 'search_page_config'

/**
 * 获取并校验搜索配置
 * @returns {Object} { phonogram, toneStyle, syllableStyle, vague }
 */
export function getValidatedSearchConfig() {
    try {
        const cached = localStorage.getItem(STORAGE_KEY)
        if (cached) {
            const config = JSON.parse(cached)

            const validated = {
                phonogram: [1, 2, 3].includes(config.phonogram) ? config.phonogram : 1,
                toneStyle: [1, 2, 3].includes(config.toneStyle) ? config.toneStyle : 1,
                syllableStyle: [1, 2].includes(config.syllableStyle) ? config.syllableStyle : 1,
                vague: typeof config.vague === 'boolean' ? config.vague : true
            }

            // 有修正则写回缓存
            const needsUpdate =
                validated.phonogram !== config.phonogram ||
                validated.toneStyle !== config.toneStyle ||
                validated.syllableStyle !== config.syllableStyle ||
                validated.vague !== config.vague

            if (needsUpdate) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    phonogram: validated.phonogram,
                    toneStyle: validated.toneStyle,
                    syllableStyle: validated.syllableStyle,
                    vague: validated.vague
                }))
            }

            return validated
        }
    } catch (err) {
        console.error('获取/校验搜索配置失败:', err)
    }

    return {
        phonogram: 1,
        toneStyle: 1,
        syllableStyle: 1,
        vague: true
    }
}

/**
 * 保存搜索配置
 * @param {Object} config
 */
export function saveSearchConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch (err) {
        console.error('保存搜索配置失败:', err)
    }
}