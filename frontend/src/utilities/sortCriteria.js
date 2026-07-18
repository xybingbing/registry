import { DateTime } from 'luxon';

export const sortByCriteria = {
  relevance: {
    value: 'RELEVANCE',
    label: '相关度'
  },
  updateTime: {
    value: 'UPDATE_TIME',
    label: '最近更新'
  },
  alphabetic: {
    value: 'ALPHABETIC_ASC',
    label: '字母顺序'
  },
  alphabeticDesc: {
    value: 'ALPHABETIC_DSC',
    label: '字母顺序 Z-A'
  },
  // stars: {
  //   value: 'STARS',
  //   label: 'Most starred'
  // },
  downloads: {
    value: 'DOWNLOADS',
    label: '最多下载'
  }
};

export const tagsSortByCriteria = {
  updateTimeDesc: {
    value: 'UPDATETIME_DESC',
    label: '最新',
    func: (a, b) => {
      return DateTime.fromISO(b.lastUpdated).diff(DateTime.fromISO(a.lastUpdated));
    }
  },
  updateTime: {
    value: 'UPDATETIME',
    label: '最早',
    func: (a, b) => {
      return DateTime.fromISO(a.lastUpdated).diff(DateTime.fromISO(b.lastUpdated));
    }
  },
  alphabetic: {
    value: 'ALPHABETIC',
    label: '字母 A - Z',
    func: (a, b) => {
      return a.tag?.localeCompare(b.tag);
    }
  },
  alphabeticDesc: {
    value: 'ALPHABETIC_DESC',
    label: '字母 Z - A',
    func: (a, b) => {
      return b.tag?.localeCompare(a.tag);
    }
  }
};
