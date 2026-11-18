-- 手动执行：只修正现有 KVS 文档中的两处简体文案，保留繁体和项目编辑结果。
UPDATE NC.kvs
SET v = JSON_SET(v,
    '$.title.sc', '谱络格栏目',
    '$.quote.sc', '一个谱络格蓝猫儿🐱正在谱络格榄茗🍵着一个谱络格栏目💻')
WHERE k = 'ysw-columns:v1';
