function envelopeOk(data) {
    return JSON.stringify({ ok: true, data: data });
}

function envelopeError(error) {
    return JSON.stringify({ ok: false, error: String(error) });
}

function getActiveProjectName() {
    try {
        if (!app.project) {
            return envelopeError("没有活动项目");
        }
        return envelopeOk({ projectName: String(app.project.name || ""), projectKey: String(app.project.documentID), rootNodeId: String(app.project.rootItem.nodeId) });
    } catch (error) {
        return envelopeError(error);
    }
}

function layerFingerprint(item) {
    var children = [];
    for (var i = 0; i < item.children.numItems; i++) {
        var child = item.children[i];
        children.push({ nodeId: String(child.nodeId), name: String(child.name), numItems: child.type === 2 ? child.children.numItems : 0 });
    }
    return children;
}

function resolveProjectItemPath(pathJson, requireBin, invalidPathMessage, missingPathMessage) {
    var path = JSON.parse(pathJson);
    if (Object.prototype.toString.call(path) !== "[object Array]") throw new Error(invalidPathMessage);
    var item = app.project.rootItem;
    for (var depth = 0; depth < path.length; depth++) {
        var index = path[depth];
        if (typeof index !== "number" || index !== Math.floor(index) || index < 0 || !item.children || index >= item.children.numItems) {
            throw new Error(missingPathMessage);
        }
        item = item.children[index];
        if (depth < path.length - 1 || requireBin) {
            if (item.type !== 2) throw new Error(missingPathMessage);
        }
    }
    return item;
}

function getLayerFingerprint(pathJson) {
    try {
        if (!app.project) return envelopeError("没有活动项目");
        var item = resolveProjectItemPath(pathJson, true, "无效的 Bin 路径", "Bin 已不存在");
        return envelopeOk({ projectKey: String(app.project.documentID), nodeId: String(item.nodeId), children: layerFingerprint(item) });
    } catch (error) {
        return envelopeError(error);
    }
}

function getChildBins(pathJson) {
    try {
        if (!app.project) return envelopeError("没有活动项目");
        var item = resolveProjectItemPath(pathJson, true, "无效的 Bin 路径", "Bin 已不存在");
        var path = JSON.parse(pathJson);
        var bins = [];
        var children = item.children;
        for (var i = 0; i < children.numItems; i++) {
            var child = children[i];
            if (child.type === 2) {
                bins.push({ path: path.concat([i]), nodeId: String(child.nodeId), name: String(child.name) });
            }
        }
        return envelopeOk({ projectKey: String(app.project.documentID), nodeId: String(item.nodeId), children: layerFingerprint(item), bins: bins });
    } catch (error) {
        return envelopeError(error);
    }
}

function getBinItems(pathJson) {
    try {
        if (!app.project) return envelopeError("没有活动项目");
        var item = resolveProjectItemPath(pathJson, true, "无效的 Bin 路径", "Bin 已不存在");
        var path = JSON.parse(pathJson);
        var items = [];
        for (var i = 0; i < item.children.numItems; i++) {
            var child = item.children[i];
            var isBin = child.type === 2;
            var mediaPath = isBin ? "" : String(child.getMediaPath() || "");
            items.push({
                path: path.concat([i]),
                guid: String(child.nodeId || ""),
                itemId: String(child.id),
                name: String(child.name || ""),
                type: Number(child.type),
                isSequence: !isBin && child.isSequence() === true,
                mediaPath: mediaPath,
                offline: !isBin && child.isOffline() === true
            });
        }
        return envelopeOk({ projectKey: String(app.project.documentID), nodeId: String(item.nodeId), children: layerFingerprint(item), items: items });
    } catch (error) {
        return envelopeError(error);
    }
}

function openProjectItem(pathJson) {
    try {
        if (!app.project) return envelopeError("没有活动项目");
        var item = resolveProjectItemPath(pathJson, false, "无效的素材路径", "素材已不存在");
        // openProjectItem 官方文档称成功返回 0，但多个 Premiere 版本实测成功时返回 undefined，
        // 源监视器已正常打开。返回值契约不可靠，故只在调用抛异常时判失败（story 18）。
        app.sourceMonitor.openProjectItem(item);
        return envelopeOk({});
    } catch (error) {
        return envelopeError(error);
    }
}

function openSequenceForItem(pathJson) {
    try {
        if (!app.project) return envelopeError("没有活动项目");
        var item = resolveProjectItemPath(pathJson, false, "无效的素材路径", "素材已不存在");
        var nodeId = String(item.nodeId);
        for (var i = 0; i < app.project.sequences.numItems; i++) {
            var sequence = app.project.sequences[i];
            var sequenceNodeId = sequence.projectItem ? String(sequence.projectItem.nodeId) : String(sequence.nodeId || "");
            if (sequenceNodeId === nodeId) {
                app.project.openSequence(String(sequence.sequenceID));
                return envelopeOk({});
            }
        }
        return envelopeError("找不到对应序列");
    } catch (error) {
        return envelopeError(error);
    }
}
