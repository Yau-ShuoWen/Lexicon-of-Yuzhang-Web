import { showSuccess } from "../services/ToastService.js";

let _initialized = false;

export function initPinyinBlock() {

    if (_initialized) return;
    _initialized = true;

    let popup = document.getElementById("rt-pinyin-popup");

    if (!popup) {
        popup = document.createElement("div");
        popup.id = "rt-pinyin-popup";
        popup.className = "rt-pinyin-popup";
        document.body.appendChild(popup);
    }

    let currentBlock = null;

    let longPressTimer = null;
    let longPressTriggered = false;
    let touchStartPos = null;

    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    // 点击
    document.addEventListener("click", onClick);

    // 长按
    if (isTouch) {

        document.addEventListener("touchstart", onTouchStart, {passive: true});
        document.addEventListener("touchend", onTouchEnd, {passive: true});
        document.addEventListener("touchmove", onTouchMove, {passive: true});
    }

    // 关闭条件
    window.addEventListener("scroll", hidePopup, true);

    window.addEventListener("resize", hidePopup);
    document.addEventListener("visibilitychange", hidePopup);

    // ---------- 函数 ----------

    // 复制按钮 SVG（内联）
    const COPY_SVG = '<svg viewBox="0 0 1024 1024" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M394.666667 106.666667h448a74.666667 74.666667 0 0 1 74.666666 74.666666v448a74.666667 74.666667 0 0 1-74.666666 74.666667H394.666667a74.666667 74.666667 0 0 1-74.666667-74.666667V181.333333a74.666667 74.666667 0 0 1 74.666667-74.666666z m0 64a10.666667 10.666667 0 0 0-10.666667 10.666666v448a10.666667 10.666667 0 0 0 10.666667 10.666667h448a10.666667 10.666667 0 0 0 10.666666-10.666667V181.333333a10.666667 10.666667 0 0 0-10.666666-10.666666H394.666667z m245.333333 597.333333a32 32 0 0 1 64 0v74.666667a74.666667 74.666667 0 0 1-74.666667 74.666666H181.333333a74.666667 74.666667 0 0 1-74.666666-74.666666V394.666667a74.666667 74.666667 0 0 1 74.666666-74.666667h74.666667a32 32 0 0 1 0 64h-74.666667a10.666667 10.666667 0 0 0-10.666666 10.666667v448a10.666667 10.666667 0 0 0 10.666666 10.666666h448a10.666667 10.666667 0 0 0 10.666667-10.666666v-74.666667z" fill="currentColor"/></svg>';

    function showPopup(blockEl) {
        currentBlock = blockEl;

        const raw = blockEl.dataset.pinyinData;

        if (!raw) return;

        const data = JSON.parse(decodeURIComponent(raw));

        let html = '<div class="rt-pinyin-popup-inner">';

        for (const pair of data.pairs) {

            // valueHtml 已经过 renderBracketContent 处理，是带拼音样式的 HTML
            html +=
                `<div class="rt-pinyin-popup-row">` +
                `<span class="rt-pinyin-popup-label">${escapeHtml(pair.label)}</span>` +
                `<span class="rt-pinyin-popup-value"${pair.isIPA ? ' data-is-ipa="1"' : ''}>${pair.valueHtml}</span>` +
                `<span class="rt-pinyin-copy-btn" title="复制">${COPY_SVG}</span>` +
                `</div>`;
        }

        html += "</div>";

        popup.innerHTML = html;

        popup.style.display = "block";

        blockEl.classList.add("active");

        requestAnimationFrame(() => {
            positionPopup(blockEl);
        });
    }

    function hidePopup() {

        if (currentBlock) currentBlock.classList.remove("active");
        currentBlock = null;
        popup.style.display = "none";
    }

    function positionPopup(blockEl) {

        const rect =
            blockEl.getBoundingClientRect();

        const popupRect =
            popup.getBoundingClientRect();

        const popupWidth = popupRect.width;

        let left =
            rect.left +
            rect.width / 2 -
            popupWidth / 2;

        left = Math.max(
            12,
            Math.min(
                left,
                window.innerWidth -
                popupWidth -
                12
            )
        );

        let top =
            rect.bottom +
            10;

        if (
            top + popupRect.height >
            window.innerHeight - 12
        ) {

            top =
                rect.top -
                popupRect.height -
                10;
        }

        top = Math.max(
            12,
            Math.min(
                top,
                window.innerHeight -
                popupRect.height -
                12
            )
        );

        popup.style.left =
            `${left}px`;

        popup.style.top =
            `${top}px`;

        // 箭头位置

        const triggerCenter =
            rect.left +
            rect.width / 2;

        const arrowLeft = Math.max(
            12,
            Math.min(
                triggerCenter -
                left -
                4,
                popupWidth - 18
            )
        );

        popup.style.setProperty(
            "--arrow-left",
            `${arrowLeft}px`
        );
    }

    function copyContent(blockEl) {

        const raw = blockEl.dataset.pinyinData;

        if (!raw) return;

        const data = JSON.parse(decodeURIComponent(raw));

        const text = data.pairs
            .map(p => {
                // valueHtml 含有 HTML 标签，剥离后得到纯文本，再转换
                const cleanValue = p.valueHtml.replace(/<[^>]+>/g, '');
                return `${p.label}：${convertPinyinForCopy(cleanValue, p.isIPA)}`;
            })
            .join("\n");

        navigator.clipboard.writeText(text).catch(() => {
        });
    }

    /** 点击单个拼音值，复制到剪贴板并弹出提示 */
    function copyValue(valueCell) {

        const raw = valueCell.textContent.trim();

        if (!raw) return;

        const isIPA = valueCell.dataset.isIpa === "1";
        const text = convertPinyinForCopy(raw, isIPA);

        navigator.clipboard.writeText(text).then(() => {

            showSuccess("复制成功");

        }).catch(() => {
        });
    }

    // ---------- 事件 handler ----------

    function onClick(e) {

        const block =
            e.target.closest(
                ".rt-pinyin-trigger"
            );

        if (block) {

            // 长按后不触发 click 弹窗
            if (block.dataset.pinyinLongPress === "1") {

                delete block.dataset.pinyinLongPress;
                return;
            }

            e.stopPropagation();

            if (currentBlock === block) {

                hidePopup();

            } else {

                showPopup(block);
            }

            return;
        }

        // 点击弹窗本身不关闭

        if (
            e.target.closest(".rt-pinyin-popup")
        ) {
            // 点击复制按钮 → 复制对应的值
            const copyBtn = e.target.closest(".rt-pinyin-copy-btn");
            if (copyBtn) {
                const row = copyBtn.closest(".rt-pinyin-popup-row");
                const valueCell = row && row.querySelector(".rt-pinyin-popup-value");
                if (valueCell) copyValue(valueCell);
                return;
            }

            // 点击右侧拼音值 → 复制该值
            const valueCell = e.target.closest(".rt-pinyin-popup-value");
            if (valueCell) {
                copyValue(valueCell);
                return;
            }

            return;
        }

        // 点击其他地方关闭

        hidePopup();
    }

    function onTouchStart(e) {

        const block =
            e.target.closest(
                ".rt-pinyin-trigger"
            );

        if (!block) return;

        longPressTriggered = false;

        touchStartPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        longPressTimer = setTimeout(() => {

            longPressTriggered = true;

            // 标记长按，阻止后续 click 事件
            block.dataset.pinyinLongPress = "1";

            copyContent(block);
        }, 600);
    }

    function onTouchEnd() {

        clearTimeout(longPressTimer);
        touchStartPos = null;
    }

    function onTouchMove(e) {

        if (!touchStartPos) return;

        const dx =
            e.touches[0].clientX -
            touchStartPos.x;

        const dy =
            e.touches[0].clientY -
            touchStartPos.y;

        if (
            Math.abs(dx) > 10 ||
            Math.abs(dy) > 10
        ) {

            clearTimeout(longPressTimer);
            touchStartPos = null;
        }
    }

    // ---------- helper ----------

    function escapeHtml(str) {

        const div =
            document.createElement("div");

        div.textContent = str;

        return div.innerHTML;
    }
}


/**
 * 拼音显示 → 复制 的转换函数
 */
export function convertPinyinForCopy(displayText, isIPA = false) {
    if (isIPA) return displayText.replace(/(.)\1{2}/g, "$1$1")  // 国际音标 把 hack 的恢复
    else return displayText.replace("ɑ", "a").replace("ɡ", "g") // 拼音 处理 a g 两个汉语习惯的但是不明显的
}