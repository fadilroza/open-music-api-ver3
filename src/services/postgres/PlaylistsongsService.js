const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const { mapDBToModel } = require('../../utils');
const NotFoundError = require('../../exceptions/NotFoundError');

class PlaylistsongsService {
  constructor(collaborationService, cacheService) {
    this._pool = new Pool();
    this._collaborationService = collaborationService;
    this._cacheService = cacheService;
  }

  async addPlaylistsong(songId, playlistId) {
    const id = `playlistsong-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlistsongs VALUES($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal ditambahkan');
    }

    await this._cacheService.delete(`playlistsongs:${playlistId}`);
    return result.rows[0].id;
  }

  async getPlaylistsong(playlistId) {
    try {
      // mendapatkan catatan dari cache
      const result = await this._cacheService.get(`playlistsongs:${playlistId}`);
      return JSON.parse(result);
    } catch (error) {
      // bila gagal, diteruskan dengan mendapatkan catatan dari database
      const query = {
        text: `SELECT playlistsongs.*, songs.title, songs.performer FROM playlistsongs LEFT JOIN songs ON songs.id = playlistsongs.song_id 
        WHERE playlistsongs.playlist_id = $1`,
        values: [playlistId],
      };
      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      const mappedResult = result.rows.map(mapDBToModel);

      // catatan akan disimpan pada cache sebelum fungsi getNotes dikembalikan
      await this._cacheService.set(`playlistsongs:${playlistId}`, JSON.stringify(mappedResult));

      return mappedResult;
    }
  }

  async deletePlaylistsong(songId, playlistId) {
    const query = {
      text: 'DELETE FROM playlistsongs WHERE song_id = $1 AND playlist_id = $2 RETURNING id',
      values: [songId, playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal dihapus');
    }

    await this._cacheService.delete(`playlistsongs:${playlistId}`);
  }

  async verifyCollaborator(songId, playlistId) {
    const query = {
      text: 'SELECT * FROM playlistsongs WHERE song_id = $1 AND playlist_id = $2',
      values: [songId, playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal diverifikasi');
    }
  }
}

module.exports = PlaylistsongsService;