export function initNoteTooltip() {

    let tooltip = document.getElementById(
        "rt-global-tooltip"
    );

    if (!tooltip) {

        tooltip = document.createElement("div");

        tooltip.id = "rt-global-tooltip";
        tooltip.className = "rt-note-tooltip";

        document.body.appendChild(tooltip);
    }

    let currentNote = null;

    const isTouch =
        window.matchMedia(
            "(pointer: coarse)"
        ).matches;

    // 桌面才需要 hover
    if (!isTouch) {

        document.addEventListener(
            "mouseover",
            onMouseOver
        );

        document.addEventListener(
            "mouseout",
            onMouseOut
        );
    }

    // 所有设备都支持点击
    document.addEventListener(
        "click",
        onClick
    );

    // 滚动立即关闭
    window.addEventListener(
        "scroll",
        hideTooltip,
        true
    );

    // 屏幕变化立即关闭
    window.addEventListener(
        "resize",
        hideTooltip
    );

    // 页面隐藏立即关闭
    document.addEventListener(
        "visibilitychange",
        hideTooltip
    );

    function showTooltip(noteEl) {

        currentNote = noteEl;

        tooltip.innerHTML =
            decodeURIComponent(
                noteEl.dataset.note || ""
            );

        tooltip.style.display = "block";

        requestAnimationFrame(() => {

            const rect =
                noteEl.getBoundingClientRect();

            const {
                width,
                height
            } =
                tooltip.getBoundingClientRect();

            let left;
            let top;

            // =====================
            // 手机
            // =====================

            if (isTouch) {

                left =
                    rect.left +
                    rect.width / 2 -
                    width / 2;

                left = Math.max(
                    12,
                    Math.min(
                        left,
                        window.innerWidth -
                        width -
                        12
                    )
                );

                top =
                    rect.bottom +
                    4;

                // 下方空间不足

                if (
                    top + height >
                    window.innerHeight - 12
                ) {

                    top =
                        rect.top -
                        height -
                        4;
                }

                // 上下都不够

                top = Math.max(
                    12,
                    Math.min(
                        top,
                        window.innerHeight -
                        height -
                        12
                    )
                );
            }

                // =====================
                // 桌面
            // =====================

            else {

                left =
                    rect.left +
                    rect.width / 2 -
                    width / 2;

                left = Math.max(
                    12,
                    Math.min(
                        left,
                        window.innerWidth -
                        width -
                        12
                    )
                );

                top =
                    rect.bottom +
                    10;

                if (
                    top + height >
                    window.innerHeight - 12
                ) {

                    top =
                        rect.top -
                        height -
                        10;
                }

                top = Math.max(
                    12,
                    Math.min(
                        top,
                        window.innerHeight -
                        height -
                        12
                    )
                );

                // 箭头

                const triggerCenter =
                    rect.left +
                    rect.width / 2;

                const arrowLeft = Math.max(
                    12,
                    Math.min(
                        triggerCenter -
                        left -
                        4,
                        width - 18
                    )
                );

                tooltip.style.setProperty(
                    "--arrow-left",
                    `${arrowLeft}px`
                );
            }

            tooltip.style.left =
                `${left}px`;

            tooltip.style.top =
                `${top}px`;
        });
    }

    function hideTooltip() {

        currentNote = null;

        tooltip.style.display =
            "none";
    }

    function onMouseOver(e) {

        const note =
            e.target.closest(
                ".rt-note"
            );

        if (!note) return;

        showTooltip(note);
    }

    function onMouseOut(e) {

        const note =
            e.target.closest(
                ".rt-note"
            );

        if (!note) return;

        const related =
            e.relatedTarget;

        if (
            related &&
            (
                related.closest(
                    ".rt-note"
                ) ||
                related.closest(
                    ".rt-note-tooltip"
                )
            )
        ) {
            return;
        }

        hideTooltip();
    }

    function onClick(e) {

        const note =
            e.target.closest(
                ".rt-note"
            );

        // 点击 note

        if (note) {

            e.stopPropagation();

            if (
                currentNote === note
            ) {

                hideTooltip();

            } else {

                showTooltip(note);
            }

            return;
        }

        // 点击 tooltip 本体

        if (
            e.target.closest(
                ".rt-note-tooltip"
            )
        ) {
            return;
        }

        // 点击其他地方

        hideTooltip();
    }
}