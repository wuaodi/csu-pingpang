/**
 * JSONBin自动同步工具 - 优化版
 * 智能缓存，减少API调用次数
 */
class AutoSync {
  constructor() {
    this.config = {
      apiKey: '$2a$10$13DfPR7U04bAFM0NSJ1NTu5dE8lE5ebiFoerD3bHqLV5KtfmjN.Ta',
      playersCollectionId: '687f2e1f7b4b8670d8a5354b',
      gamesCollectionId: '687f2e61f7e7a370d1ebd072',
      apiBase: 'https://api.jsonbin.io/v3/b',
      syncInterval: 5 * 60 * 1000,
      cacheExpiry: 2 * 60 * 1000,
      maxRetries: 2,
      batchSync: true
    };
    this.isBackground = true;
    this.cache = new Map();
    this.pendingSync = false;
  }

  // 获取数据
  async fetchData(collectionId) {
    try {
      const cacheKey = `fetch_${collectionId}`;
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.config.apiBase}/${collectionId}/latest`,
          method: 'GET',
          header: {
            'X-Access-Key': this.config.apiKey,
            'Content-Type': 'application/json'
          },
          success: resolve,
          fail: reject
        });
      });

      if (response.statusCode === 200) {
        const record = response.data.record;
        let data = [];
        
        if (record && typeof record === 'object' && record.init !== undefined) {
          data = [];
        } else {
          data = Array.isArray(record) ? record : [];
        }

        this.setCachedData(cacheKey, data);
        return data;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  }

  // 推送数据
  async pushData(collectionId, data) {
    try {
      const cacheKey = `fetch_${collectionId}`;
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData && JSON.stringify(cachedData) === JSON.stringify(data)) {
        return true;
      }
      
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.config.apiBase}/${collectionId}`,
          method: 'PUT',
          header: {
            'X-Access-Key': this.config.apiKey,
            'Content-Type': 'application/json'
          },
          data: data,
          success: resolve,
          fail: reject
        });
      });

      if (response.statusCode === 200) {
        this.setCachedData(cacheKey, data);
        this.updateApiStats();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // 同步选手数据
  async syncPlayers() {
    try {
      const localPlayers = wx.getStorageSync('players') || [];
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      
      const mergedPlayers = this.mergePlayers(localPlayers, cloudPlayers);
      
      if (JSON.stringify(localPlayers) !== JSON.stringify(mergedPlayers)) {
        wx.setStorageSync('players', mergedPlayers);
      }
      
      if (JSON.stringify(cloudPlayers) !== JSON.stringify(mergedPlayers)) {
        await this.pushData(this.config.playersCollectionId, mergedPlayers);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // 同步比赛数据
  async syncGames() {
    try {
      const localGames = wx.getStorageSync('games') || [];
      const cloudGames = await this.fetchData(this.config.gamesCollectionId);
      
      const mergedGames = this.mergeGames(localGames, cloudGames);
      
      if (JSON.stringify(localGames) !== JSON.stringify(mergedGames)) {
        wx.setStorageSync('games', mergedGames);
      }
      
      if (JSON.stringify(cloudGames) !== JSON.stringify(mergedGames)) {
        await this.pushData(this.config.gamesCollectionId, mergedGames);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // 完整同步
  async fullSync() {
    if (this.pendingSync) {
      return false;
    }
    
    this.pendingSync = true;
    
    try {
      const playersSuccess = await this.syncPlayers();
      const gamesSuccess = await this.syncGames();
      
      const success = playersSuccess && gamesSuccess;
      this.setLastSync();
      return success;
    } finally {
      this.pendingSync = false;
    }
  }

  // 智能同步
  async smartSync() {
    if (!this.shouldSync()) {
      return false;
    }
    
    return await this.fullSync();
  }

  // 强制同步
  async forceSync() {
    this.clearCache();
    return await this.fullSync();
  }

  // 合并选手数据
  mergePlayers(local, cloud) {
    const merged = new Map();
    
    [...local, ...cloud].forEach(player => {
      const existing = merged.get(player.name);
      if (!existing) {
        merged.set(player.name, { ...player });
      } else {
        merged.set(player.name, {
          ...existing,
          totalGames: Math.max(existing.totalGames || 0, player.totalGames || 0),
          wins: Math.max(existing.wins || 0, player.wins || 0),
          losses: Math.max(existing.losses || 0, player.losses || 0)
        });
      }
    });
    
    return Array.from(merged.values());
  }

  // 合并比赛数据
  mergeGames(local, cloud) {
    const merged = new Map();
    
    [...local, ...cloud].forEach(game => {
      if (!merged.has(game.id)) {
        merged.set(game.id, game);
      }
    });
    
    return Array.from(merged.values())
      .sort((a, b) => new Date(b.gameTime) - new Date(a.gameTime));
  }

  // 缓存管理
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // 同步控制
  shouldSync() {
    const lastSync = wx.getStorageSync('lastSyncTime') || 0;
    return Date.now() - lastSync > this.config.syncInterval;
  }

  setLastSync() {
    wx.setStorageSync('lastSyncTime', Date.now());
  }

  // API统计
  updateApiStats() {
    const stats = wx.getStorageSync('apiStats') || { requests: 0, lastReset: Date.now() };
    stats.requests++;
    wx.setStorageSync('apiStats', stats);
  }

  getApiStats() {
    return wx.getStorageSync('apiStats') || { requests: 0, lastReset: Date.now() };
  }
}

module.exports = new AutoSync(); 