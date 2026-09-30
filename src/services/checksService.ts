import { apiService, WriteResult } from './apiService';
import { 
  WelfareCheckRecord, 
  FoodSurveyRecord, 
  FoodMealRating, 
  RoomCheckRecord, 
  RoomCheckItem 
} from '../types';

export const checksService = {
  // =========================================================================
  // WELFARE CHECKS
  // =========================================================================
  async listWelfareChecks(options?: { site?: string; limit?: number }): Promise<{ success: boolean; data: WelfareCheckRecord[]; error?: string }> {
    const eq = options?.site && options.site !== 'all' && options.site !== 'All Sites' ? { site_name: options.site } : undefined;
    return await apiService.fetchEntityRecords<WelfareCheckRecord>('welfareChecks', {
      order: 'check_datetime.desc',
      limit: options?.limit,
      eq
    });
  },

  async getWelfareCheck(id: string): Promise<{ success: boolean; data?: WelfareCheckRecord; error?: string }> {
    const res = await apiService.fetchEntityRecords<WelfareCheckRecord>('welfareChecks', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      return { success: true, data: res.data[0] };
    }
    return { success: false, error: res.error || 'Record not found' };
  },

  async createWelfareCheck(data: Partial<WelfareCheckRecord>): Promise<WriteResult<WelfareCheckRecord>> {
    return await apiService.saveEntityRecord<WelfareCheckRecord>('welfareChecks', data as WelfareCheckRecord, {
      action: 'CREATE',
      module: 'Welfare Checks',
      targetItem: data.portReference || data.id,
      site: data.siteName,
      details: `Created welfare check for SU ${data.portReference} at ${data.siteName}${data.officerName ? ` by ${data.officerName}` : ''}`
    });
  },

  async updateWelfareCheck(id: string, data: Partial<WelfareCheckRecord>): Promise<WriteResult<WelfareCheckRecord>> {
    return await apiService.updateEntityRecord<WelfareCheckRecord>('welfareChecks', id, data, {
      action: 'UPDATE',
      module: 'Welfare Checks',
      targetItem: data.portReference || id,
      site: data.siteName,
      details: `Updated welfare check ${id} for SU ${data.portReference || 'SU'}${data.officerName ? ` by ${data.officerName}` : ''}`
    });
  },

  async deleteWelfareCheck(id: string, siteName?: string, portRef?: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('welfareChecks', id, {
      action: 'DELETE',
      module: 'Welfare Checks',
      targetItem: portRef || id,
      site: siteName,
      details: `Deleted welfare check ${id}`
    });
  },

  // =========================================================================
  // FOOD SURVEY CHECKS
  // =========================================================================
  async listFoodSurveys(options?: { site?: string; limit?: number }): Promise<{ success: boolean; data: FoodSurveyRecord[]; error?: string }> {
    const eq = options?.site && options.site !== 'all' && options.site !== 'All Sites' ? { site_name: options.site } : undefined;
    const res = await apiService.fetchEntityRecords<FoodSurveyRecord>('foodSurveys', {
      order: 'created_at.desc',
      limit: options?.limit,
      eq
    });
    return res;
  },

  async getFoodSurvey(id: string): Promise<{ success: boolean; data?: FoodSurveyRecord; error?: string }> {
    const res = await apiService.fetchEntityRecords<FoodSurveyRecord>('foodSurveys', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      const survey = res.data[0];
      // Fetch associated meal ratings
      try {
        const ratingsRes = await apiService.fetchEntityRecords<FoodMealRating>('foodMealRatings', {
          eq: { food_survey_id: id }
        });
        if (ratingsRes.success && ratingsRes.data) {
          survey.mealRatings = ratingsRes.data;
        }
      } catch (err) {
        console.warn('Could not fetch child meal ratings:', err);
      }
      return { success: true, data: survey };
    }
    return { success: false, error: res.error || 'Record not found' };
  },

  async createFoodSurvey(data: Partial<FoodSurveyRecord>): Promise<WriteResult<FoodSurveyRecord>> {
    // Save main survey
    const mainResult = await apiService.saveEntityRecord<FoodSurveyRecord>('foodSurveys', data as FoodSurveyRecord, {
      action: 'CREATE',
      module: 'Food Survey Checks',
      targetItem: data.portReference || data.id,
      site: data.siteName,
      details: `Created food survey for SU ${data.portReference} at ${data.siteName}${data.houseOfficerName ? ` by ${data.houseOfficerName}` : ''}`
    });

    if (mainResult.success && data.mealRatings && data.mealRatings.length > 0) {
      const surveyId = (mainResult.record as any)?.id || data.id;
      // Persist individual meal ratings in child table
      for (const rating of data.mealRatings) {
        try {
          await apiService.saveEntityRecord<FoodMealRating>('foodMealRatings', {
            id: `fmr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            foodSurveyId: surveyId,
            dayOfWeek: rating.dayOfWeek,
            mealType: rating.mealType,
            rating: rating.rating
          } as any);
        } catch (e) {
          console.warn('Error saving child meal rating:', e);
        }
      }
    }
    return mainResult;
  },

  async updateFoodSurvey(id: string, data: Partial<FoodSurveyRecord>): Promise<WriteResult<FoodSurveyRecord>> {
    const result = await apiService.updateEntityRecord<FoodSurveyRecord>('foodSurveys', id, data, {
      action: 'UPDATE',
      module: 'Food Survey Checks',
      targetItem: data.portReference || id,
      site: data.siteName,
      details: `Updated food survey ${id} for SU ${data.portReference || 'SU'}${data.houseOfficerName ? ` by ${data.houseOfficerName}` : ''}`
    });

    if (result.success && data.mealRatings && data.mealRatings.length > 0) {
      // Synchronize ratings into child table
      for (const rating of data.mealRatings) {
        try {
          if (rating.id) {
            await apiService.updateEntityRecord<FoodMealRating>('foodMealRatings', rating.id, rating);
          } else {
            await apiService.saveEntityRecord<FoodMealRating>('foodMealRatings', {
              id: `fmr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              foodSurveyId: id,
              dayOfWeek: rating.dayOfWeek,
              mealType: rating.mealType,
              rating: rating.rating
            } as any);
          }
        } catch (e) {
          console.warn('Error updating child meal rating:', e);
        }
      }
    }

    return result;
  },

  async deleteFoodSurvey(id: string, siteName?: string, portRef?: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('foodSurveys', id, {
      action: 'DELETE',
      module: 'Food Survey Checks',
      targetItem: portRef || id,
      site: siteName,
      details: `Deleted food survey ${id}`
    });
  },

  // =========================================================================
  // ROOM CHECKS
  // =========================================================================
  async listRoomChecks(options?: { site?: string; limit?: number }): Promise<{ success: boolean; data: RoomCheckRecord[]; error?: string }> {
    const eq = options?.site && options.site !== 'all' && options.site !== 'All Sites' ? { site_name: options.site } : undefined;
    return await apiService.fetchEntityRecords<RoomCheckRecord>('roomChecks', {
      order: 'inspection_date.desc',
      limit: options?.limit,
      eq
    });
  },

  async getRoomCheck(id: string): Promise<{ success: boolean; data?: RoomCheckRecord; error?: string }> {
    const res = await apiService.fetchEntityRecords<RoomCheckRecord>('roomChecks', {
      eq: { id },
      limit: 1
    });
    if (res.success && res.data && res.data.length > 0) {
      const roomCheck = res.data[0];
      try {
        const itemsRes = await apiService.fetchEntityRecords<RoomCheckItem>('roomCheckItems', {
          eq: { room_check_id: id },
          order: 'sort_order.asc'
        });
        if (itemsRes.success && itemsRes.data) {
          roomCheck.items = itemsRes.data;
        }
      } catch (err) {
        console.warn('Could not fetch room check items:', err);
      }
      return { success: true, data: roomCheck };
    }
    return { success: false, error: res.error || 'Record not found' };
  },

  async createRoomCheck(data: Partial<RoomCheckRecord>): Promise<WriteResult<RoomCheckRecord>> {
    const mainResult = await apiService.saveEntityRecord<RoomCheckRecord>('roomChecks', data as RoomCheckRecord, {
      action: 'CREATE',
      module: 'Room Checks',
      targetItem: `Room ${data.roomNumber} (${data.siteName})`,
      site: data.siteName,
      details: `Created room check for Room ${data.roomNumber} at ${data.siteName} (Status: ${data.overallStatus})${data.officerName ? ` by ${data.officerName}` : ''}`
    });

    if (mainResult.success && data.items && data.items.length > 0) {
      const checkId = (mainResult.record as any)?.id || data.id;
      for (const item of data.items) {
        try {
          await apiService.saveEntityRecord<RoomCheckItem>('roomCheckItems', {
            id: `rci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            roomCheckId: checkId,
            section: item.section,
            questionKey: item.questionKey,
            questionText: item.questionText,
            response: item.response,
            comment: item.comment || '',
            sortOrder: item.sortOrder
          } as any);
        } catch (e) {
          console.warn('Error saving room check item:', e);
        }
      }
    }

    return mainResult;
  },

  async updateRoomCheck(id: string, data: Partial<RoomCheckRecord>): Promise<WriteResult<RoomCheckRecord>> {
    const result = await apiService.updateEntityRecord<RoomCheckRecord>('roomChecks', id, data, {
      action: 'UPDATE',
      module: 'Room Checks',
      targetItem: `Room ${data.roomNumber || ''} (${data.siteName || ''})`,
      site: data.siteName,
      details: `Updated room check ${id} (Status: ${data.overallStatus})${data.officerName ? ` by ${data.officerName}` : ''}`
    });

    if (result.success && data.items && data.items.length > 0) {
      for (const item of data.items) {
        try {
          if (item.id) {
            await apiService.updateEntityRecord<RoomCheckItem>('roomCheckItems', item.id, item);
          } else {
            await apiService.saveEntityRecord<RoomCheckItem>('roomCheckItems', {
              id: `rci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              roomCheckId: id,
              section: item.section,
              questionKey: item.questionKey,
              questionText: item.questionText,
              response: item.response,
              comment: item.comment || '',
              sortOrder: item.sortOrder
            } as any);
          }
        } catch (e) {
          console.warn('Error updating room check item:', e);
        }
      }
    }

    return result;
  },

  async deleteRoomCheck(id: string, siteName?: string, roomNumber?: string): Promise<WriteResult> {
    return await apiService.deleteEntityRecord('roomChecks', id, {
      action: 'DELETE',
      module: 'Room Checks',
      targetItem: roomNumber ? `Room ${roomNumber}` : id,
      site: siteName,
      details: `Deleted room check ${id}`
    });
  }
};
