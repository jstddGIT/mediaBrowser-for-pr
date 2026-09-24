function parseEnvelope(raw) {
  try {
    var envelope = JSON.parse(raw);
    if (envelope && envelope.ok === true) return { ok: true, data: envelope.data };
    if (envelope && envelope.ok === false) {
      return { ok: false, error: String(envelope.error || '未知宿主错误') };
    }
    return { ok: false, error: '宿主返回了无效信封' };
  } catch (error) {
    return { ok: false, error: String(raw || '无法解析宿主返回值') };
  }
}

function updateBinNode(node, path, change) {
  if (node.path.length === path.length && node.path.every(function (part, index) { return part === path[index]; })) {
    return change(node);
  }
  if (!node.children) return node;
  var children = node.children.map(function (child) { return updateBinNode(child, path, change); });
  if (children.every(function (child, index) { return child === node.children[index]; })) return node;
  return Object.assign({}, node, { children: children });
}

function toggleBinNode(tree, path) {
  var loadPath = null;
  var updated = updateBinNode(tree, path, function (node) {
    if (!node.expanded && node.children === null) loadPath = path;
    return Object.assign({}, node, { expanded: !node.expanded });
  });
  return { tree: updated, loadPath: loadPath };
}

function setBinChildren(tree, path, children) {
  return updateBinNode(tree, path, function (node) {
    return Object.assign({}, node, { children: children });
  });
}

function fingerprintChildren(children) {
  return JSON.stringify(children.map(function (child) {
    return [String(child.nodeId), String(child.name), Number(child.numItems)];
  }));
}

function fingerprintChanged(before, after) {
  return before !== after;
}

function mediaTypeFromPath(mediaPath) {
  var match = String(mediaPath || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  var extension = match ? match[1] : '';
  if (/^(mp4|m4v|mov|avi|mxf|wmv|webm|mkv|flv|mpeg|mpg|ts|mts|m2ts|3gp)$/.test(extension)) return 'video';
  if (/^(wav|mp3|aac|m4a|aif|aiff|flac|ogg|wma)$/.test(extension)) return 'audio';
  if (/^(jpg|jpeg|png|webp|gif|bmp)$/.test(extension)) return 'image';
  return 'other';
}

function nativePathToFileUrl(nativePath) {
  var segments = String(nativePath || '').replace(/\\/g, '/').split('/');
  return 'file:///' + segments.map(function (segment, index) {
    var encoded = encodeURIComponent(segment);
    return index === 0 ? encoded.replace(/%3A/gi, ':') : encoded;
  }).join('/');
}

function openActionForItem(item) {
  if (item && item.type === 2) return 'drilldown';
  if (!item || item.type !== 1) return null;
  if (item.isSequence) return 'sequence';
  return 'source';
}

function paginationState(total, visible) {
  var remaining = Math.max(0, total - visible);
  return { remaining: remaining, hasMore: remaining > 0 };
}

var mediaBrowser = { parseEnvelope: parseEnvelope, toggleBinNode: toggleBinNode, setBinChildren: setBinChildren, mediaTypeFromPath: mediaTypeFromPath, nativePathToFileUrl: nativePathToFileUrl, openActionForItem: openActionForItem, fingerprintChildren: fingerprintChildren, fingerprintChanged: fingerprintChanged, paginationState: paginationState };
if (typeof module !== 'undefined') module.exports = mediaBrowser;
if (typeof window !== 'undefined') window.MediaBrowser = mediaBrowser;
