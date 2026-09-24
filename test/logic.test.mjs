import test from 'node:test';
import assert from 'node:assert/strict';
import logic from '../js/logic.js';
const { parseEnvelope, toggleBinNode, setBinChildren, mediaTypeFromPath, nativePathToFileUrl, openActionForItem } = logic;
const { fingerprintChildren, fingerprintChanged } = logic;

test('分页显示剩余项，并仅在有未展示项时提供加载更多', () => {
  assert.deepEqual(logic.paginationState(0, 0), { remaining: 0, hasMore: false });
  assert.deepEqual(logic.paginationState(120, 120), { remaining: 0, hasMore: false });
  assert.deepEqual(logic.paginationState(500, 120), { remaining: 380, hasMore: true });
  assert.deepEqual(logic.paginationState(500, 480), { remaining: 20, hasMore: true });
  assert.deepEqual(logic.paginationState(500, 500), { remaining: 0, hasMore: false });
});

test('指纹区分子项内容、数量与顺序，不因相同输入误报', () => {
  const original = [{ nodeId: 'a', name: 'A', numItems: 0 }, { nodeId: 'b', name: 'B', numItems: 2 }];
  const fingerprint = fingerprintChildren(original);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren(original.map(item => ({ ...item })))), false);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren([...original].reverse())), true);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren([{ ...original[0], name: '改名' }, original[1]])), true);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren([{ ...original[0], nodeId: 'c' }, original[1]])), true);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren([original[0], { ...original[1], numItems: 3 }])), true);
  assert.equal(fingerprintChanged(fingerprint, fingerprintChildren([original[0]])), true);
  assert.equal(fingerprintChanged(fingerprintChildren([]), fingerprintChildren([])), false);
  assert.notEqual(fingerprintChildren([{ nodeId: 'a|b', name: 'c', numItems: 0 }]), fingerprintChildren([{ nodeId: 'a', name: 'b|c', numItems: 0 }]));
});

test('解析成功信封并返回 data', () => {
  assert.deepEqual(parseEnvelope('{"ok":true,"data":{"projectName":"Demo"}}'), {
    ok: true,
    data: { projectName: 'Demo' },
  });
});

test('解析失败信封并返回 error', () => {
  assert.deepEqual(parseEnvelope('{"ok":false,"error":"没有活动项目"}'), {
    ok: false,
    error: '没有活动项目',
  });
});

test('非法 JSON 转为可展示的失败结果', () => {
  assert.deepEqual(parseEnvelope('EvalScript error.'), {
    ok: false,
    error: 'EvalScript error.',
  });
});

test('展开只请求该层，折叠后再次展开复用已加载子项', () => {
  const initial = { path: [], name: '项目', expanded: true, children: [
    { path: [0], name: 'A', expanded: false, children: null },
    { path: [2], name: 'B', expanded: false, children: null },
  ] };
  const opened = toggleBinNode(initial, [0]);
  assert.deepEqual(opened.loadPath, [0]);
  assert.equal(opened.tree.children[0].expanded, true);
  assert.equal(opened.tree.children[1], initial.children[1]);
  const loaded = setBinChildren(opened.tree, [0], [
    { path: [0, 3], name: '深层', expanded: false, children: null },
  ]);
  assert.deepEqual(loaded.children[0].children[0].path, [0, 3]);
  assert.equal(loaded.children[0].expanded, true);
  const closed = toggleBinNode(loaded, [0]);
  assert.equal(closed.loadPath, null);
  assert.equal(closed.tree.children[0].expanded, false);
  const reopened = toggleBinNode(closed.tree, [0]);
  assert.equal(reopened.loadPath, null);
  assert.deepEqual(reopened.tree.children[0].children, loaded.children[0].children);
  assert.equal(initial.children[0].children, null);
});

test('深层展开只请求目标节点，不影响同名兄弟节点', () => {
  const tree = { path: [], expanded: true, children: [
    { path: [0], name: '同名', expanded: true, children: [
      { path: [0, 1], name: '内层', expanded: false, children: null },
    ] },
    { path: [1], name: '同名', expanded: false, children: null },
  ] };
  const result = toggleBinNode(tree, [0, 1]);
  assert.deepEqual(result.loadPath, [0, 1]);
  assert.equal(result.tree.children[0].children[0].expanded, true);
  assert.equal(result.tree.children[1], tree.children[1]);
  assert.equal(tree.children[0].children[0].expanded, false);
});
test('按扩展名判断视频、音频、图片和其他类型', () => {
  assert.equal(mediaTypeFromPath('C:/素材/clip.MP4'), 'video');
  assert.equal(mediaTypeFromPath('C:/素材/music.WAV'), 'audio');
  assert.equal(mediaTypeFromPath('C:/素材/photo.png'), 'image');
  assert.equal(mediaTypeFromPath('C:/素材/raw.CR3'), 'other');
  assert.equal(mediaTypeFromPath(''), 'other');
});

test('Windows 路径转换为正确 file URL，并编码中文、空格与特殊字符', () => {
  assert.equal(
    nativePathToFileUrl('C:\\素材库\\带 空格#问号?.jpg'),
    'file:///C:/%E7%B4%A0%E6%9D%90%E5%BA%93/%E5%B8%A6%20%E7%A9%BA%E6%A0%BC%23%E9%97%AE%E5%8F%B7%3F.jpg',
  );
});

test('空路径转换为空 file URL', () => {
  assert.equal(nativePathToFileUrl(''), 'file:///');
});

test('双击项按 Bin、序列和所有 CLIP 素材分派打开动作', () => {
  assert.equal(openActionForItem({ type: 2 }), 'drilldown');
  assert.equal(openActionForItem({ type: 1, isSequence: true }), 'sequence');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: 'C:/a.mp4' }), 'source');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: 'C:/a.png' }), 'source');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: 'C:/a.tif' }), 'source');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: 'C:/a.psd' }), 'source');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: 'C:/a.r3d' }), 'source');
  assert.equal(openActionForItem({ type: 1, isSequence: false, mediaPath: '' }), 'source');
});

test('非序列 Bin 以外的项目类型不发起宿主打开调用', () => {
  assert.equal(openActionForItem({ type: 3, mediaPath: 'C:/a.tif' }), null);
  assert.equal(openActionForItem({ type: 4, mediaPath: 'C:/a.r3d' }), null);
  assert.equal(openActionForItem(null), null);
});
