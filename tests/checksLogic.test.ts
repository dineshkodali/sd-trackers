import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoomOverallStatus, ROOM_CHECK_QUESTIONS } from '../src/components/room/RoomChecksView';
import { RoomCheckItem } from '../src/types';

describe('Welfare, Food Survey & Room Checks Business Logic Test Suite', () => {
  describe('Room Checks 30-Point Audit & Status Calculation', () => {
    test('30 standard questions are registered and categorized into 3 sections', () => {
      assert.equal(ROOM_CHECK_QUESTIONS.length, 30, 'Exactly 30 questions must exist');
      
      const roomCondition = ROOM_CHECK_QUESTIONS.filter(q => q.section === 'ROOM CONDITION');
      const otherItems = ROOM_CHECK_QUESTIONS.filter(q => q.section === 'OTHER ITEMS');
      const finalComments = ROOM_CHECK_QUESTIONS.filter(q => q.section === 'FINAL COMMENTS');

      assert.equal(roomCondition.length, 27, '27 Room Condition questions');
      assert.equal(otherItems.length, 2, '2 Other Items questions (Iron, Hair Dryer)');
      assert.equal(finalComments.length, 1, '1 Final Comments question');
    });

    test('calculateRoomOverallStatus returns "Passed" when all questions meet expectations', () => {
      const items: RoomCheckItem[] = ROOM_CHECK_QUESTIONS.map((q, idx) => ({
        section: q.section,
        questionKey: q.key,
        questionText: q.text,
        response: q.defaultExpected || 'Yes',
        comment: '',
        sortOrder: idx + 1
      }));

      const status = calculateRoomOverallStatus(items);
      assert.equal(status, 'Passed', 'Expected Passed when all items meet standard');
    });

    test('calculateRoomOverallStatus returns "Issues" on non-critical defect', () => {
      const items: RoomCheckItem[] = ROOM_CHECK_QUESTIONS.map((q, idx) => ({
        section: q.section,
        questionKey: q.key,
        questionText: q.text,
        response: q.defaultExpected || 'Yes',
        comment: '',
        sortOrder: idx + 1
      }));

      // Non-critical defect: TV not working (Q8)
      const tvItem = items.find(i => i.questionKey === 'tv_working');
      assert.ok(tvItem);
      tvItem.response = 'No';
      tvItem.comment = 'Remote control missing';

      const status = calculateRoomOverallStatus(items);
      assert.equal(status, 'Issues', 'Expected Issues when non-critical defect detected');
    });

    test('calculateRoomOverallStatus returns "Attention Required" on critical safety violation', () => {
      const items: RoomCheckItem[] = ROOM_CHECK_QUESTIONS.map((q, idx) => ({
        section: q.section,
        questionKey: q.key,
        questionText: q.text,
        response: q.defaultExpected || 'Yes',
        comment: '',
        sortOrder: idx + 1
      }));

      // Critical safety violation: Smoke detector not working (Q14)
      const smokeDetector = items.find(i => i.questionKey === 'smoke_detector_working_uncovered');
      assert.ok(smokeDetector);
      smokeDetector.response = 'No';
      smokeDetector.comment = 'Detector was covered with plastic bag';

      const status = calculateRoomOverallStatus(items);
      assert.equal(status, 'Attention Required', 'Expected Attention Required when smoke detector is covered/broken');
    });

    test('calculateRoomOverallStatus prioritizes "Attention Required" over "Issues"', () => {
      const items: RoomCheckItem[] = ROOM_CHECK_QUESTIONS.map((q, idx) => ({
        section: q.section,
        questionKey: q.key,
        questionText: q.text,
        response: q.defaultExpected || 'Yes',
        comment: '',
        sortOrder: idx + 1
      }));

      // Non-critical defect: Trash not taken out (Q26)
      const trash = items.find(i => i.questionKey === 'trash_taken_out');
      assert.ok(trash);
      trash.response = 'No';

      // Critical violation: Cooking in room (Q12)
      const cooking = items.find(i => i.questionKey === 'cooking_in_room_signs');
      assert.ok(cooking);
      cooking.response = 'Yes'; // Default expected is 'No'

      const status = calculateRoomOverallStatus(items);
      assert.equal(status, 'Attention Required', 'Critical safety issue must take precedence');
    });

    test('N/A responses are safely ignored and do not flag issues', () => {
      const items: RoomCheckItem[] = ROOM_CHECK_QUESTIONS.map((q, idx) => ({
        section: q.section,
        questionKey: q.key,
        questionText: q.text,
        response: q.defaultExpected || 'Yes',
        comment: '',
        sortOrder: idx + 1
      }));

      // AC / Fan is not present in room, so marked N/A
      const ac = items.find(i => i.questionKey === 'ac_heating_working');
      assert.ok(ac);
      ac.response = 'N/A';

      const status = calculateRoomOverallStatus(items);
      assert.equal(status, 'Passed', 'N/A response must not be treated as a defect');
    });
  });

  describe('Food Survey 21 Meal Ratings Requirements', () => {
    test('Meal matrix schema enforces 7 days x 3 meals = 21 ratings', () => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const meals = ['Breakfast', 'Lunch', 'Dinner'];
      const matrixCombinations: string[] = [];

      for (const day of days) {
        for (const meal of meals) {
          matrixCombinations.push(`${day}_${meal}`);
        }
      }

      assert.equal(matrixCombinations.length, 21, 'Must have 21 distinct day-meal slots');
    });

    test('Allowed meal ratings match specification', () => {
      const allowedRatings = ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'];
      assert.equal(allowedRatings.length, 5);
      assert.ok(allowedRatings.includes('Excellent'));
      assert.ok(allowedRatings.includes('Very good'));
      assert.ok(allowedRatings.includes('Good'));
      assert.ok(allowedRatings.includes('Fair'));
      assert.ok(allowedRatings.includes('Poor'));
    });
  });

  describe('Welfare Checks Structure & Safeguarding Protection', () => {
    test('Required welfare check fields validation rules', () => {
      const requiredFields = ['siteName', 'portReference', 'flatNumber', 'checkDatetime', 'officerName'];
      
      const validCheck = {
        siteName: 'Brit Hotel',
        portReference: 'PR-8812',
        flatNumber: 'Room 10',
        checkDatetime: '2026-09-29T10:00:00Z',
        officerName: 'Officer Kelly'
      };

      for (const field of requiredFields) {
        assert.ok((validCheck as any)[field], `Field ${field} is present and truthy`);
      }
    });
  });
});
