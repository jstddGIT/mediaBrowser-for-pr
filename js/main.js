(function () {
  'use strict';

  var logic = window.MediaBrowser;
  var status = document.getElementById('status');
  var refresh = document.getElementById('refresh');
  var treeElement = document.getElementById('bin-tree');
  var gridElement = document.getElementById('media-grid');
  var gridMessage = document.getElementById('grid-message');
  var loadMore = document.getElementById('load-more');
  var host = window.__adobe_cep__ && typeof CSInterface !== 'undefined' ? new CSInterface() : null;
  var tree = null;
  var selectedPath = null;
  var selectedPathKey = null;
  var selectedKey = null;
  var selectedNodeId = null;
  var generation = 0;
  var pending = {};
  var projectKey = null;
  var selectionGeneration = 0;
  var fingerprints = {};
  var polling = false;
  var gridItems = [];
  var visibleCount = 0;
  var renderGeneration = 0;

  function isCurrent(currentGeneration, key, data) {
    return currentGeneration === generation && key === projectKey && data.projectKey === key;
  }

  function findNode(node, path) {
    if (!node) return null;
    if (JSON.stringify(node.path) === JSON.stringify(path)) return node;
    if (node.children) for (var i = 0; i < node.children.length; i++) {
      var found = findNode(node.children[i], path);
      if (found) return found;
    }
    return null;
  }

  function rebaseNode(node, path) {
    return Object.assign({}, node, { path: path, children: node.children && node.children.map(function (child) {
      return rebaseNode(child, path.concat(child.path[child.path.length - 1]));
    }) });
  }

  function visibleLayers(node, layers) {
    if (!node || !node.expanded) return;
    layers.push(node);
    if (node.children) node.children.forEach(function (child) { visibleLayers(child, layers); });
  }

  function callHost(expression, callback) {
    host.evalScript(expression, function (raw) { callback(logic.parseEnvelope(raw)); });
  }

  function openItem(item) {
    var action = logic.openActionForItem(item);
    if (action === 'drilldown') {
      selectBin(item.path);
      return;
    }
    if (!host) { status.textContent = '未连接 Premiere 宿主'; return; }
    var pathJson = JSON.stringify(item.path);
    var currentGeneration = generation;
    var key = projectKey;
    var expression = action === 'sequence'
      ? 'openSequenceForItem(' + JSON.stringify(pathJson) + ')'
      : 'openProjectItem(' + JSON.stringify(pathJson) + ')';
    callHost(expression, function (result) {
      if (currentGeneration !== generation || key !== projectKey) return;
      if (!result.ok) status.textContent = '打开失败：' + result.error;
    });
  }



  function selectBin(path) {
    selectedPath = path;
    selectedPathKey = JSON.stringify(path);
    var currentSelection = ++selectionGeneration;
    var currentGeneration = generation;
    var key = projectKey;
    var node = findNode(tree, path);
    var nodeId = node && node.nodeId;
    selectedNodeId = nodeId || selectedNodeId;
    renderGridMessage('正在读取 Bin…');
    if (!host) { renderGridMessage('未连接 Premiere 宿主'); return; }
    callHost('getBinItems(' + JSON.stringify(JSON.stringify(path)) + ')', function (result) {
      if (currentSelection !== selectionGeneration || selectedPathKey !== JSON.stringify(path) || currentGeneration !== generation) return;
      if (!result.ok) { renderGridMessage('读取素材失败：' + result.error); return; }
      if (!isCurrent(currentGeneration, key, result.data) || (nodeId && result.data.nodeId !== nodeId)) { loadProject(); return; }
      selectedNodeId = result.data.nodeId;
      fingerprints[JSON.stringify(path)] = logic.fingerprintChildren(result.data.children);
      renderGrid(result.data.items);
    });
  }

  function renderGridMessage(message) {
    ++renderGeneration;
    gridItems = [];
    visibleCount = 0;
    gridElement.replaceChildren();
    loadMore.hidden = true;
    gridMessage.textContent = message;
    gridMessage.hidden = false;
  }

  function mediaLabel(item, mediaType) {
    if (item.isSequence) return '序列';
    return { video: '视频', audio: '音频', image: '图片', other: '其他' }[mediaType] || '素材';
  }

  function renderGrid(items) {
    ++renderGeneration;
    gridItems = items;
    visibleCount = 0;
    gridElement.replaceChildren();
    loadMore.hidden = true;
    gridMessage.hidden = items.length !== 0;
    gridMessage.textContent = items.length ? '' : '此 Bin 为空';
    if (items.length) appendPage();
  }

  function appendPage() {
    var token = renderGeneration;
    var end = Math.min(visibleCount + 120, gridItems.length);
    loadMore.hidden = true;
    function appendBatch() {
      if (token !== renderGeneration) return;
      var fragment = document.createDocumentFragment();
      var batchEnd = Math.min(visibleCount + 30, end);
      for (; visibleCount < batchEnd; visibleCount++) fragment.appendChild(createCard(gridItems[visibleCount]));
      gridElement.appendChild(fragment);
      if (visibleCount < end) requestAnimationFrame(appendBatch);
      else {
        var page = logic.paginationState(gridItems.length, visibleCount);
        loadMore.hidden = !page.hasMore;
        if (page.hasMore) loadMore.textContent = '加载更多（剩余 ' + page.remaining + ' 项）';
      }
    }
    requestAnimationFrame(appendBatch);
  }

  loadMore.addEventListener('click', appendPage);

  function createCard(item) {
      var card = document.createElement('button');
      var isBin = item.type === 2;
      var mediaType = logic.mediaTypeFromPath(item.mediaPath);
      card.type = 'button';
      card.className = 'media-card' + (isBin ? ' bin-card' : '') + (selectedKey === item.guid + item.itemId ? ' selected' : '');
      card.dataset.key = item.guid + item.itemId;
      var preview = document.createElement('span');
      preview.className = 'media-preview';
      if (isBin) preview.textContent = '▰';
      else if (mediaType === 'image') {
        var image = document.createElement('img');
        image.src = logic.nativePathToFileUrl(item.mediaPath);
        image.loading = 'lazy';
        image.alt = item.name;
        image.onerror = function () {
          image.onerror = null;
          image.remove();
          preview.textContent = '图片';
        };
        preview.appendChild(image);
      } else preview.textContent = item.isSequence ? '▤' : (mediaType === 'video' ? '▶' : mediaType === 'audio' ? '♫' : '▧');
      card.appendChild(preview);
      var name = document.createElement('span');
      name.className = 'media-name';
      name.textContent = item.name;
      card.appendChild(name);
      if (item.offline) {
        var mark = document.createElement('span');
        mark.className = 'offline-mark';
        mark.textContent = '离线';
        card.appendChild(mark);
      }
      card.addEventListener('click', function () {
        if (isBin) selectBin(item.path);
        else {
          selectedKey = item.guid + item.itemId;
          card.parentNode.querySelectorAll('.media-card').forEach(function (other) { other.classList.toggle('selected', other === card); });
          status.textContent = '已选中：' + item.name + '（' + mediaLabel(item, mediaType) + (item.offline ? '，离线' : '') + '）';
        }
      });
      card.addEventListener('dblclick', function () { openItem(item); });
      return card;
  }

  function renderNode(node, container, depth) {
    var row = document.createElement('div');
    row.className = 'bin-row';
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(depth + 1));
    row.setAttribute('aria-expanded', String(node.expanded));
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'bin-toggle';
    button.textContent = (node.expanded ? '▾ ' : '▸ ') + node.name;
    button.setAttribute('aria-label', (node.expanded ? '折叠 ' : '展开 ') + node.name);
    button.addEventListener('click', function () { selectBin(node.path); toggle(node.path); });
    row.appendChild(button);
    container.appendChild(row);
    if (!node.expanded) return;
    var group = document.createElement('div');
    group.className = 'bin-children';
    group.setAttribute('role', 'group');
    if (node.children === null) {
      var message = document.createElement('span');
      message.className = 'bin-message';
      message.textContent = pending[JSON.stringify(node.path)] ? '正在加载…' : '读取失败，请折叠后重试';
      group.appendChild(message);
    } else node.children.forEach(function (child) { renderNode(child, group, depth + 1); });
    container.appendChild(group);
  }

  function renderTree() { treeElement.replaceChildren(); if (tree) renderNode(tree, treeElement, 0); }

  function loadChildren(path, currentGeneration, oldChildren, selectedNodeId) {
    var pathKey = JSON.stringify(path);
    if (pending[pathKey]) return;
    var key = projectKey;
    var node = findNode(tree, path);
    var nodeId = node && node.nodeId;
    pending[pathKey] = true;
    renderTree();
    callHost('getChildBins(' + JSON.stringify(pathKey) + ')', function (result) {
      if (currentGeneration !== generation) return;
      delete pending[pathKey];
      if (!result.ok) {
        status.textContent = '读取 Bin 失败：' + result.error;
        if (pathKey === '[]' && !selectedPath) renderGridMessage('读取 Bin 失败：' + result.error);
        renderTree();
        return;
      }
      if (!isCurrent(currentGeneration, key, result.data) || (nodeId && result.data.nodeId !== nodeId)) { loadProject(); return; }
      fingerprints[pathKey] = logic.fingerprintChildren(result.data.children);
      tree = logic.setBinChildren(tree, path, result.data.bins.map(function (bin) {
        var previous = oldChildren && oldChildren.find(function (child) { return child.nodeId === bin.nodeId; });
        return previous ? rebaseNode(Object.assign({}, previous, { name: bin.name, children: previous.expanded ? null : previous.children }), bin.path)
          : { path: bin.path, name: bin.name, nodeId: bin.nodeId, expanded: false, children: null };
      }));
      if (pathKey === '[]' && !selectedPath) renderGridMessage('请选择一个 Bin');
      renderTree();
      result.data.bins.forEach(function (bin) {
        var child = findNode(tree, bin.path);
        var previous = oldChildren && oldChildren.find(function (old) { return old.nodeId === bin.nodeId; });
        if (child && child.expanded) loadChildren(bin.path, currentGeneration, previous && previous.children, selectedNodeId);
      });
      if (selectedNodeId) {
        var selected = findNodeById(tree, selectedNodeId);
        if (nodeId === selectedNodeId) selectBin(path);
        else if (selected && !selected.expanded) selectBin(selected.path);
        else if (!selected && !result.data.bins.some(function (bin) { return findNode(tree, bin.path).expanded; })) {
          selectedPath = null; selectedPathKey = null; renderGridMessage('请选择一个 Bin');
        }
      }
    });
  }

  function findNodeById(node, nodeId) {
    if (!node || !nodeId) return null;
    if (node.nodeId === nodeId) return node;
    if (node.children) for (var i = 0; i < node.children.length; i++) {
      var found = findNodeById(node.children[i], nodeId);
      if (found) return found;
    }
    return null;
  }

  function refreshLayer(path) {
    var node = findNode(tree, path);
    if (!node && selectedPathKey === JSON.stringify(path)) {
      ++generation;
      ++selectionGeneration;
      fingerprints = {};
      selectBin(path);
      return;
    }
    if (!node) return;
    var selected = selectedPath && findNode(tree, selectedPath);
    var previousSelectionId = selected ? selected.nodeId : selectedNodeId;
    var affectsSelection = selectedPath && JSON.stringify(selectedPath.slice(0, path.length)) === JSON.stringify(path);
    var oldChildren = node.children;
    ++generation;
    ++selectionGeneration;
    pending = {};
    fingerprints = {};
    tree = logic.setBinChildren(tree, path, null);
    if (affectsSelection) renderGridMessage('正在读取 Bin…');
    loadChildren(path, generation, oldChildren, affectsSelection && selectedPathKey !== JSON.stringify(path) ? previousSelectionId : null);
    if (affectsSelection && selectedPathKey === JSON.stringify(path)) selectBin(path);
  }

  function toggle(path) {
    var result = logic.toggleBinNode(tree, path);
    tree = result.tree;
    if (result.loadPath) loadChildren(result.loadPath, generation); else renderTree();
  }

  function loadProject() {
    var currentGeneration = ++generation;
    ++selectionGeneration;
    projectKey = null;
    fingerprints = {};
    pending = {};
    tree = null;
    selectedPath = null;
    selectedPathKey = null;
    selectedNodeId = null;
    selectedKey = null;
    renderTree();
    renderGridMessage('正在读取当前项目…');
    status.textContent = '正在读取当前项目…';
    if (!host) { status.textContent = '未连接 Premiere 宿主'; renderGridMessage('未连接 Premiere 宿主'); return; }
    callHost('getActiveProjectName()', function (result) {
      if (currentGeneration !== generation) return;
      if (!result.ok) {
        var noProject = result.error === '没有活动项目';
        status.textContent = noProject ? '没有活动项目' : '读取项目失败：' + result.error;
        renderGridMessage(noProject ? '没有活动项目，请在 Premiere 中打开项目' : '读取项目失败：' + result.error);
        return;
      }
      projectKey = result.data.projectKey;
      var name = result.data.projectName || '未命名项目';
      status.textContent = '当前项目：' + name;
      tree = { path: [], nodeId: result.data.rootNodeId, name: name, expanded: true, children: null };
      loadChildren([], currentGeneration);
    });
  }

  function poll() {
    if (!host || polling) return;
    polling = true;
    var currentGeneration = generation;
    var key = projectKey;
    callHost('getActiveProjectName()', function (project) {
      if (currentGeneration !== generation) { polling = false; return; }
      if (!project.ok && !tree && key === null) { polling = false; return; }
      if (!project.ok || project.data.projectKey !== key || (tree && project.data.rootNodeId !== tree.nodeId)) {
        polling = false;
        loadProject();
        return;
      }
      var layers = [];
      visibleLayers(tree, layers);
      var selected = selectedPath && findNode(tree, selectedPath);
      if (selectedPath && !selected && selectedNodeId) layers.push({ path: selectedPath, nodeId: selectedNodeId });
      else if (selected && !layers.some(function (node) { return node.nodeId === selected.nodeId; })) layers.push(selected);
      function check(index) {
        if (currentGeneration !== generation) { polling = false; return; }
        if (index === layers.length) { polling = false; return; }
        var node = layers[index];
        var pathKey = JSON.stringify(node.path);
        callHost('getLayerFingerprint(' + JSON.stringify(pathKey) + ')', function (result) {
          if (currentGeneration !== generation) { polling = false; return; }
          if (!result.ok || !isCurrent(currentGeneration, key, result.data) || result.data.nodeId !== node.nodeId) {
            polling = false;
            loadProject();
            return;
          }
          var next = logic.fingerprintChildren(result.data.children);
          if (fingerprints[pathKey] !== undefined && logic.fingerprintChanged(fingerprints[pathKey], next)) {
            polling = false;
            refreshLayer(node.path);
            return;
          }
          fingerprints[pathKey] = next;
          check(index + 1);
        });
      }
      check(0);
    });
  }
  refresh.addEventListener('click', function () {
    if (!host || !tree) { loadProject(); return; }
    var currentGeneration = generation;
    var key = projectKey;
    callHost('getActiveProjectName()', function (result) {
      if (currentGeneration !== generation) return;
      if (!result.ok || result.data.projectKey !== key || result.data.rootNodeId !== tree.nodeId) { loadProject(); return; }
      refreshLayer(selectedPath || []);
    });
  });
  if (host) {
    host.addEventListener('documentAfterActivate', loadProject);
    setInterval(poll, 1500);
  }
  loadProject();
}());
