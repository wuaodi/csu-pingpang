/**
 * JSONBin远程同步工具 - 无缓存版本
 * 所有操作都以远程数据为主，确保数据完全同步
 */
class AutoSync {
  constructor() {
    this.config = {
      apiKey: 'xxxxxxxxxxx',
      playersCollectionId: 'xxxxxxxxxxx',
      gamesCollectionId: 'xxxxxxxxxxxxx',
      apiBase: 'https://api.jsonbin.io/v3/b',
      maxRetries: 3
    };
  }

  // 直接从远程获取数据，不使用缓存
  async fetchData(collectionId) {
    try {
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

        return data;
      } else {
        throw new Error(`HTTP ${response.statusCode}`);
      }
    } catch (error) {
      console.error('获取远程数据失败:', error);
      throw error;
    }
  }

  // 直接推送数据到远程，不进行数据比较
  async pushData(collectionId, data) {
    try {
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
        // 同时更新本地存储，仅作为临时缓存
        if (collectionId === this.config.playersCollectionId) {
          wx.setStorageSync('players', data);
        } else if (collectionId === this.config.gamesCollectionId) {
          wx.setStorageSync('games', data);
        }
        return true;
      } else {
        throw new Error(`HTTP ${response.statusCode}`);
      }
    } catch (error) {
      console.error('推送数据到远程失败:', error);
      throw error;
    }
  }

  // 获取远程选手数据，更新到本地
  async loadPlayersFromRemote() {
    try {
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      wx.setStorageSync('players', cloudPlayers);
      return cloudPlayers;
    } catch (error) {
      console.error('从远程加载选手数据失败:', error);
      return wx.getStorageSync('players') || [];
    }
  }

  // 获取远程比赛数据，更新到本地
  async loadGamesFromRemote() {
    try {
      const cloudGames = await this.fetchData(this.config.gamesCollectionId);
      wx.setStorageSync('games', cloudGames);
      return cloudGames;
    } catch (error) {
      console.error('从远程加载比赛数据失败:', error);
      return wx.getStorageSync('games') || [];
    }
  }

  // 添加选手到远程
  async addPlayer(playerName) {
    try {
      // 先获取远程最新数据
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      
      // 检查选手是否已存在
      const existingPlayer = cloudPlayers.find(p => p.name === playerName);
      if (existingPlayer) {
        throw new Error('选手已存在');
      }

      // 创建新选手
      const newPlayer = {
        id: Date.now(),
        name: playerName,
        totalGames: 0,
        wins: 0,
        losses: 0,
        createTime: new Date().toISOString()
      };

      // 添加到远程数据
      const updatedPlayers = [...cloudPlayers, newPlayer];
      await this.pushData(this.config.playersCollectionId, updatedPlayers);
      
      return newPlayer;
    } catch (error) {
      console.error('添加选手失败:', error);
      throw error;
    }
  }

  // 删除选手从远程
  async deletePlayer(playerId) {
    try {
      // 先获取远程最新数据
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      
      // 过滤掉要删除的选手
      const updatedPlayers = cloudPlayers.filter(p => p.id !== playerId);
      
      // 推送到远程
      await this.pushData(this.config.playersCollectionId, updatedPlayers);
      
      return true;
    } catch (error) {
      console.error('删除选手失败:', error);
      throw error;
    }
  }

  // 添加比赛记录到远程
  async addGame(gameRecord) {
    try {
      // 先获取远程最新数据
      const cloudGames = await this.fetchData(this.config.gamesCollectionId);
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      
      // 添加比赛记录
      const updatedGames = [gameRecord, ...cloudGames];
      
      // 更新选手统计
      const updatedPlayers = this.updatePlayerStatsForGame(cloudPlayers, gameRecord);
      
      // 同时推送比赛和选手数据
      await Promise.all([
        this.pushData(this.config.gamesCollectionId, updatedGames),
        this.pushData(this.config.playersCollectionId, updatedPlayers)
      ]);
      
      return true;
    } catch (error) {
      console.error('添加比赛记录失败:', error);
      throw error;
    }
  }

  // 更新选手统计数据（基于单场比赛）
  updatePlayerStatsForGame(players, gameRecord) {
    const { player1, player2, winner } = gameRecord;
    
    return players.map(player => {
      if (player.name === player1.name) {
        return {
          ...player,
          totalGames: (player.totalGames || 0) + 1,
          wins: (player.wins || 0) + (winner === player1.name ? 1 : 0),
          losses: (player.losses || 0) + (winner === player2.name ? 1 : 0)
        };
      } else if (player.name === player2.name) {
        return {
          ...player,
          totalGames: (player.totalGames || 0) + 1,
          wins: (player.wins || 0) + (winner === player2.name ? 1 : 0),
          losses: (player.losses || 0) + (winner === player1.name ? 1 : 0)
        };
      }
      return player;
    });
  }

  // 完整同步：从远程加载所有数据
  async fullSync() {
    try {
      const [cloudPlayers, cloudGames] = await Promise.all([
        this.fetchData(this.config.playersCollectionId),
        this.fetchData(this.config.gamesCollectionId)
      ]);
      
      // 直接覆盖本地数据
      wx.setStorageSync('players', cloudPlayers);
      wx.setStorageSync('games', cloudGames);
      
      return true;
    } catch (error) {
      console.error('完整同步失败:', error);
      return false;
    }
  }

  // 重新计算所有选手统计数据（基于远程比赛记录）
  async recalculatePlayerStats() {
    try {
      const cloudGames = await this.fetchData(this.config.gamesCollectionId);
      const cloudPlayers = await this.fetchData(this.config.playersCollectionId);
      
      // 重置所有选手统计
      const resetPlayers = cloudPlayers.map(player => ({
        ...player,
        totalGames: 0,
        wins: 0,
        losses: 0
      }));
      
      // 基于所有比赛记录重新计算
      const recalculatedPlayers = cloudGames.reduce((players, game) => {
        return this.updatePlayerStatsForGame(players, game);
      }, resetPlayers);
      
      // 推送到远程
      await this.pushData(this.config.playersCollectionId, recalculatedPlayers);
      
      return recalculatedPlayers;
    } catch (error) {
      console.error('重新计算选手统计失败:', error);
      throw error;
    }
  }
}

module.exports = new AutoSync(); 
