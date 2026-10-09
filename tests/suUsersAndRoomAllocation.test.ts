import test from 'node:test';
import assert from 'node:assert/strict';
import { suPropertyService } from '../src/services/suPropertyService';
import { signAdminToken } from '../server/tokenSigner';
import { setAuditUserContext } from '../src/services/apiService';

// Initialize Super Admin session context for test suite
const adminToken = signAdminToken({
  sub: 'super-admin-test',
  email: 'stackmaster@sdcommercial.co.uk',
  role: 'Super Admin',
  iss: 'sdtracker-internal',
  exp: Math.floor(Date.now() / 1000) + 7200
});

setAuditUserContext({
  token: adminToken,
  role: 'Super Admin',
  userId: 'super-admin-test',
  userName: 'Super Admin',
  userEmail: 'stackmaster@sdcommercial.co.uk'
});

test('SU Users & Room Allocation Workflow Suite', async (t) => {

  await t.test('1. Validation: Rejects missing required fields and duplicate records', async () => {
    // Missing required names
    const missingFirst = await suPropertyService.validateServiceUser({ firstName: '', lastName: 'ValidLast' });
    assert.equal(missingFirst.valid, false, 'Should reject missing firstName');
    assert.match(missingFirst.error || '', /first name.*required/i);

    const missingLast = await suPropertyService.validateServiceUser({ firstName: 'ValidFirst', lastName: '' });
    assert.equal(missingLast.valid, false, 'Should reject missing lastName');
    assert.match(missingLast.error || '', /last name.*required/i);

    // Valid data
    const validData = await suPropertyService.validateServiceUser({
      firstName: 'Integration',
      lastName: 'Tester',
      externalReference: 'EXT-TEST-UNIQUE-999'
    });
    assert.equal(validData.valid, true);
  });

  await t.test('2. Room Occupancy & Capacity: Multi-bed rooms and reallocation workflow', async () => {
    // 1. Create property
    const propRes = await suPropertyService.createProperty({
      propertyName: 'E2E Allocation House',
      propertyReference: `E2E-PROP-${Date.now()}`,
      status: 'Active',
      maximumOccupancy: 10,
      siteId: 'site-443'
    });
    assert.equal(propRes.success, true, 'Property creation should succeed');
    const prop = propRes.record!;

    // 2. Create Single Room (Cap: 1) and Twin Room (Cap: 2)
    const singleRes = await suPropertyService.createRoom({
      propertyId: prop.id,
      roomNumber: '1',
      roomReference: `E2E-R1-${Date.now()}`,
      roomType: 'Single Bedroom',
      capacity: 1,
      status: 'Available',
      occupancyStatus: 'Available'
    });
    assert.equal(singleRes.success, true);
    const roomSingle = singleRes.record!;

    const twinRes = await suPropertyService.createRoom({
      propertyId: prop.id,
      roomNumber: '2',
      roomReference: `E2E-R2-${Date.now()}`,
      roomType: 'Twin Bedroom',
      capacity: 2,
      status: 'Available',
      occupancyStatus: 'Available'
    });
    assert.equal(twinRes.success, true);
    const roomTwin = twinRes.record!;

    // 3. Create two Service Users
    const su1Res = await suPropertyService.createServiceUser({
      firstName: 'Resident',
      lastName: 'One',
      status: 'Active'
    });
    assert.equal(su1Res.success, true);
    const su1 = su1Res.record!;

    const su2Res = await suPropertyService.createServiceUser({
      firstName: 'Resident',
      lastName: 'Two',
      status: 'Active'
    });
    assert.equal(su2Res.success, true);
    const su2 = su2Res.record!;

    // 4. Place Resident One into Twin Room -> Twin room should become 'Partially Occupied'
    const plc1Res = await suPropertyService.createPlacement({
      suId: su1.id,
      siteId: prop.siteId || 'site-443',
      propertyId: prop.id,
      roomId: roomTwin.id,
      startDate: new Date().toISOString()
    });
    assert.equal(plc1Res.success, true, 'Placement 1 should succeed');

    const twinCheck1 = await suPropertyService.getRoom(roomTwin.id);
    assert.equal(twinCheck1.data?.status, 'Partially Occupied', 'Twin room should be Partially Occupied (1/2)');
    assert.equal(twinCheck1.data?.occupancyStatus, 'Partially Occupied');

    // 5. Place Resident Two into Twin Room -> Twin room should now become 'Occupied'
    const plc2Res = await suPropertyService.createPlacement({
      suId: su2.id,
      siteId: prop.siteId || 'site-443',
      propertyId: prop.id,
      roomId: roomTwin.id,
      startDate: new Date().toISOString()
    });
    assert.equal(plc2Res.success, true, 'Placement 2 should succeed');

    const twinCheck2 = await suPropertyService.getRoom(roomTwin.id);
    assert.equal(twinCheck2.data?.status, 'Occupied', 'Twin room should be Occupied (2/2)');
    assert.equal(twinCheck2.data?.occupancyStatus, 'Occupied');

    // 6. Attempting to place a 3rd user into the full Twin room must be rejected
    const su3Res = await suPropertyService.createServiceUser({
      firstName: 'Resident',
      lastName: 'Three',
      status: 'Active'
    });
    const su3 = su3Res.record!;

    const overAllocRes = await suPropertyService.createPlacement({
      suId: su3.id,
      siteId: prop.siteId || 'site-443',
      propertyId: prop.id,
      roomId: roomTwin.id,
      startDate: new Date().toISOString()
    });
    assert.equal(overAllocRes.success, false, 'Over-allocation must be rejected');
    assert.match(overAllocRes.error || '', /capacity/i);

    // 7. Move Resident One from Twin Room to Single Room
    const moveRes = await suPropertyService.moveServiceUser(
      su1.id,
      prop.siteId || 'site-443',
      prop.id,
      roomSingle.id,
      new Date().toISOString(),
      'Relocated to Single room'
    );
    assert.equal(moveRes.success, true, 'Move should succeed');

    const twinCheck3 = await suPropertyService.getRoom(roomTwin.id);
    const singleCheck = await suPropertyService.getRoom(roomSingle.id);
    assert.equal(twinCheck3.data?.status, 'Partially Occupied', 'Twin room should revert to Partially Occupied (1/2 remaining)');
    assert.equal(singleCheck.data?.status, 'Occupied', 'Single room should now be Occupied (1/1)');

    // 8. Clean up created entities
    await suPropertyService.deleteServiceUser(su1.id);
    await suPropertyService.deleteServiceUser(su2.id);
    await suPropertyService.deleteServiceUser(su3.id);
    await suPropertyService.deleteRoom(roomSingle.id);
    await suPropertyService.deleteRoom(roomTwin.id);
    await suPropertyService.deleteProperty(prop.id);
  });

  await t.test('3. Deactivating/Discharging an SU ends placement and releases room', async () => {
    const propRes = await suPropertyService.createProperty({
      propertyName: 'Discharge Test House',
      propertyReference: `DISCH-PROP-${Date.now()}`,
      status: 'Active',
      siteId: 'site-443'
    });
    const prop = propRes.record!;

    const roomRes = await suPropertyService.createRoom({
      propertyId: prop.id,
      roomNumber: '10',
      roomReference: `DISCH-R10-${Date.now()}`,
      roomType: 'Studio',
      capacity: 1,
      status: 'Available'
    });
    const room = roomRes.record!;

    const suRes = await suPropertyService.createServiceUser({
      firstName: 'Dave',
      lastName: 'Discharge',
      status: 'Active'
    });
    const su = suRes.record!;

    await suPropertyService.createPlacement({
      suId: su.id,
      siteId: prop.siteId || 'site-443',
      propertyId: prop.id,
      roomId: room.id,
      startDate: new Date().toISOString()
    });

    const roomOccupied = await suPropertyService.getRoom(room.id);
    assert.equal(roomOccupied.data?.status, 'Occupied');

    // Updating SU status to 'Discharged' should automatically end active placement and release room
    const updateRes = await suPropertyService.updateServiceUser(su.id, {
      status: 'Discharged'
    });
    assert.equal(updateRes.success, true);

    const roomReleased = await suPropertyService.getRoom(room.id);
    assert.equal(roomReleased.data?.status, 'Available', 'Room should be released to Available upon SU discharge');

    // Clean up
    await suPropertyService.deleteServiceUser(su.id);
    await suPropertyService.deleteRoom(room.id);
    await suPropertyService.deleteProperty(prop.id);
  });
});
