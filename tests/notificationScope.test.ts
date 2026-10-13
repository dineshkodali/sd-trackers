import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filterNotificationsForRole, isSameSite, isSameUser, deriveInAppNotifications, type NotificationItem } from '../src/services/inAppNotificationService';

const n = (over: Partial<NotificationItem>): NotificationItem => ({
  id: over.id || Math.random().toString(36).slice(2), title: 't', description: 'd', time: 'now', type: 'info', read: false, ...over,
});

const BRIT = 'Brit Hotel';
const LEIGHAM = 'Leigham Court Hotel';
const ALL = [BRIT, LEIGHAM, 'Maida Vale Aparthotel'];

const sam = { userRole: 'Staff' as const, assignedSite: BRIT, allowedSites: [BRIT], currentUserName: 'Sam Staff', userEmail: 'sam@x.test', authProfileId: 'u-sam' };
const lee = { userRole: 'Staff' as const, assignedSite: LEIGHAM, allowedSites: [LEIGHAM], currentUserName: 'Lee Other', userEmail: 'lee@x.test', authProfileId: 'u-lee' };
const rita = { userRole: 'Regional Manager' as const, assignedSite: BRIT, allowedSites: [BRIT, LEIGHAM], currentUserName: 'Rita RM', userEmail: 'rita@x.test', authProfileId: 'u-rita' };
const admin = { userRole: 'Admin' as const, assignedSite: 'All Sites', allowedSites: ALL, currentUserName: 'Ada Admin', userEmail: 'ada@x.test', authProfileId: 'u-ada' };
const superAdmin = { userRole: 'Super Admin' as const, assignedSite: 'All Sites', allowedSites: ALL, currentUserName: 'Sue Super', userEmail: 'sue@x.test', authProfileId: 'u-sue' };

const visible = (user: any, list: NotificationItem[]) => filterNotificationsForRole({ notifications: list, ...user }).map(x => x.id);

describe('Notifications — strict visibility', () => {
  test('site users see only notifications from their own assigned site', () => {
    const list = [
      n({ id: 'brit', site: BRIT, category: 'site_activity', performedByUser: 'Someone Else' }),
      n({ id: 'leigham', site: LEIGHAM, category: 'site_activity', performedByUser: 'Someone Else' }),
      n({ id: 'urgent-leigham', site: LEIGHAM, type: 'urgent', action: 'URGENT', category: 'critical_security' }),
    ];
    assert.deepEqual(visible(sam, list), ['brit']);
    assert.deepEqual(visible(lee, list), ['leigham', 'urgent-leigham']);
  });

  test('site names are compared exactly: no wildcard, no partial match', () => {
    assert.equal(isSameSite('Brit Hotel', 'brit hotel'), true);
    assert.equal(isSameSite('Brit Hotel', 'Brit-Hotel'), true);
    assert.equal(isSameSite('Brit Hotel', 'Brit Hotel Annex'), false);
    assert.equal(isSameSite('Brit', 'Brit Hotel'), false);
    assert.equal(isSameSite('All Sites', 'Brit Hotel'), false);
    assert.equal(isSameSite('', ''), false);
    const list = [n({ id: 'annex', site: 'Brit Hotel Annex' }), n({ id: 'global', site: 'All Sites' }), n({ id: 'nosite' })];
    assert.deepEqual(visible(sam, list), [], 'a site user never sees other sites, "All Sites" items, or site-less items from other people');
  });

  test('another person\'s personal or user-to-user notifications are never shown, admins included (apart from changes they made themselves)', () => {
    const list = [
      n({ id: 'sam-profile', category: 'profile_personal', targetItem: 'Sam Staff', performedByUser: 'Ada Admin' }),
      n({ id: 'lee-profile', category: 'profile_personal', targetItem: 'Lee Other', performedByUser: 'Ada Admin', site: LEIGHAM }),
      n({ id: 'to-lee', targetUserId: 'u-lee', site: LEIGHAM }),
      n({ id: 'to-sam', targetUserId: 'u-sam', site: BRIT }),
    ];
    assert.deepEqual(visible(sam, list).sort(), ['sam-profile', 'to-sam']);
    assert.deepEqual(visible(lee, list).sort(), ['lee-profile', 'to-lee']);
    assert.deepEqual(visible(rita, list), [], 'a manager does not see other people\'s personal items');
    assert.deepEqual(visible(admin, list).sort(), ['lee-profile', 'sam-profile'], 'admin sees only the changes she made herself');
    assert.deepEqual(visible(superAdmin, list), []);
  });

  test('your own actions and own personal items are visible to you', () => {
    const list = [n({ id: 'mine', performedByUser: 'Sam Staff' }), n({ id: 'mine-email', performedByUser: 'sam@x.test', site: BRIT }), n({ id: 'theirs', performedByUser: 'Lee Other' })];
    assert.deepEqual(visible(sam, list).sort(), ['mine', 'mine-email']);
  });

  test('people are matched exactly, never by a shared part of the name', () => {
    assert.equal(isSameUser('Sam Staff', 'Sam Staff'), true);
    assert.equal(isSameUser('sam@x.test', 'Sam Staff', 'sam@x.test'), true);
    assert.equal(isSameUser('Sam', 'Sam Staff'), false);
    assert.equal(isSameUser('Sam Staff Jr', 'Sam Staff'), false);
    assert.equal(isSameUser('', ''), false);
    assert.deepEqual(visible(sam, [n({ id: 'x', category: 'profile_personal', targetItem: 'Sam' })]), []);
  });

  test('managers see only the sites they cover; admins see every site', () => {
    const list = [n({ id: 'a', site: BRIT }), n({ id: 'b', site: LEIGHAM }), n({ id: 'c', site: 'Maida Vale Aparthotel' })];
    assert.deepEqual(visible(rita, list), ['a', 'b']);
    assert.deepEqual(visible(admin, list), ['a', 'b', 'c']);
    assert.deepEqual(visible(superAdmin, list), ['a', 'b', 'c']);
  });

  test('requests: the requester and the managers / admins of that site, nobody else', () => {
    const req = n({ id: 'req', category: 'approval_workflow', site: BRIT, performedByUser: 'Sam Staff', module: 'Requests' });
    assert.deepEqual(visible(sam, [req]), ['req']);
    assert.deepEqual(visible(rita, [req]), ['req']);
    assert.deepEqual(visible(admin, [req]), ['req']);
    assert.deepEqual(visible(lee, [req]), [], 'a colleague at another site cannot see it');
    const otherStaffSameSite = { ...sam, currentUserName: 'Pat Peer', authProfileId: 'u-pat', userEmail: 'pat@x.test' };
    assert.deepEqual(visible(otherStaffSameSite, [req]), [], 'a colleague at the same site cannot see someone else\'s request');
    const farAway = n({ id: 'far', category: 'approval_workflow', site: 'Maida Vale Aparthotel', performedByUser: 'Zed' });
    assert.deepEqual(visible(rita, [farAway]), [], 'a manager does not see requests from sites they do not cover');
  });

  test('security / roles / settings notifications are for administrators only', () => {
    const list = [n({ id: 'sec', action: 'SECURITY', site: BRIT }), n({ id: 'roles', module: 'Roles', site: BRIT })];
    assert.deepEqual(visible(sam, list), []);
    assert.deepEqual(visible(rita, list), []);
    assert.deepEqual(visible(admin, list), ['sec', 'roles']);
  });

  test('notifications raised in your own session (e.g. a failed save) are always yours', () => {
    const items = deriveInAppNotifications({ auditLogs: [], escalations: [], dataChangeRequests: [], extraNotifications: [n({ id: 'err', title: 'Table layout was NOT saved', action: 'SECURITY' })] });
    assert.equal(items[0].local, true);
    assert.deepEqual(visible(sam, items), ['err']);
  });

  test('a person with no sites assigned sees no site notifications', () => {
    const nobody = { ...sam, assignedSite: '', allowedSites: [] as string[] };
    assert.deepEqual(visible(nobody, [n({ id: 'a', site: BRIT })]), []);
  });
});
