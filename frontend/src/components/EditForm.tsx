/**
 * 図面編集フォーム
 */

import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import type { Drawing } from '../types/drawing';

interface EditFormProps {
  drawing: Drawing;
  onSave: (data: Partial<Drawing>) => void;
  onApprove?: () => void;
  onReject?: () => void;
  disabled?: boolean;
  onBalloonClick?: (balloon: { x: number; y: number; width: number; height: number }) => void;
}

export default function EditForm({
  drawing,
  onSave,
  onApprove,
  onReject,
  disabled = false,
  onBalloonClick,
}: EditFormProps) {
  const [activeTab, setActiveTab] = useState<'fields' | 'balloons'>('fields');

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      pdf_filename: drawing.pdf_filename || '',
      classification: drawing.classification || '',
      summary: drawing.summary || '',
    },
  });

  // drawing が変更されたら、フォームの値をリセット
  useEffect(() => {
    reset({
      pdf_filename: drawing.pdf_filename || '',
      classification: drawing.classification || '',
      summary: drawing.summary || '',
    });
  }, [drawing, reset]);

  const onSubmit = (data: Record<string, string>) => {
    onSave(data);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-me-grey-dark';
    if (confidence >= 70) return 'text-me-grey-dark';
    return 'text-me-red';
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white rounded-me border border-me-grey-medium p-6">
          <h3 className="text-lg font-semibold mb-4 text-me-grey-deep">基本情報</h3>

          <div className="space-y-4">
            {/* ファイル名 */}
            <div>
              <label className="block text-sm font-medium text-me-grey-dark mb-1">
                ファイル名（編集可能）
              </label>
              <input
                type="text"
                {...register('pdf_filename')}
                className="w-full px-3 py-2 border border-me-grey-medium rounded-me focus:ring-me-red focus:border-me-red"
                disabled={disabled}
              />
              <p className="text-xs text-me-grey-medium mt-1">
                元のファイル名: {drawing.original_filename}
              </p>
            </div>

            {/* 分類 */}
            <div>
              <label className="block text-sm font-medium text-me-grey-dark mb-1">
                分類
              </label>
              <select
                {...register('classification')}
                className="w-full px-3 py-2 border border-me-grey-medium rounded-me focus:ring-me-red focus:border-me-red"
              >
                <option value="">未分類</option>
                <option value="部品図">部品図</option>
                <option value="ユニット図">ユニット図</option>
                <option value="組図">組図</option>
              </select>
              {drawing.classification_confidence && (
                <p
                  className={`text-xs mt-1 ${getConfidenceColor(
                    drawing.classification_confidence
                  )}`}
                >
                  信頼度: {drawing.classification_confidence}%
                </p>
              )}
            </div>

            {/* 要約 */}
            <div>
              <label className="block text-sm font-medium text-me-grey-dark mb-1">
                要約
              </label>
              <textarea
                {...register('summary')}
                rows={3}
                className="w-full px-3 py-2 border border-me-grey-medium rounded-me focus:ring-me-red focus:border-me-red"
              />
            </div>
          </div>
        </div>

        {/* タブUI: 抽出フィールドと風船情報 */}
        <div className="bg-white rounded-me border border-me-grey-medium">
          {/* タブヘッダー */}
          <div className="flex border-b border-me-grey-medium">
            <button
              type="button"
              onClick={() => setActiveTab('fields')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'fields'
                  ? 'bg-me-red text-white border-b-2 border-me-red'
                  : 'text-me-grey-dark hover:bg-me-grey-light'
              }`}
            >
              抽出フィールド
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('balloons')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'balloons'
                  ? 'bg-me-red text-white border-b-2 border-me-red'
                  : 'text-me-grey-dark hover:bg-me-grey-light'
              }`}
            >
              風船情報
            </button>
          </div>

          {/* タブコンテンツ */}
          <div className="p-6">
            {/* 抽出フィールドタブ */}
            {activeTab === 'fields' && (
              <div className="space-y-3">
                {drawing.extracted_fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-me-grey-light rounded-me border border-me-grey-medium"
                  >
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-me-grey-dark">
                        {field.field_name}
                      </label>
                      <input
                        type="text"
                        defaultValue={field.field_value}
                        className="mt-1 w-full px-3 py-2 border border-me-grey-medium rounded-me text-sm"
                      />
                    </div>
                    <div className="ml-4">
                      <span
                        className={`text-sm font-medium ${getConfidenceColor(
                          field.confidence
                        )}`}
                      >
                        {field.confidence}%
                      </span>
                      {field.confidence < 70 && (
                        <p className="text-xs text-me-red mt-1">要確認</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 風船情報タブ */}
            {activeTab === 'balloons' && (
              <>
                {drawing.balloons.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-me-grey-medium">
                      <thead className="bg-me-grey-light">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-me-grey-dark">
                            上部
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-me-grey-dark">
                            下部
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-me-grey-dark">
                            付随情報
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-me-grey-dark">
                            信頼度
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-me-grey-medium">
                        {drawing.balloons.map((balloon, index) => {
                          // 座標情報を取得（coordinatesまたはx,yから）
                          const hasCoordinates = balloon.coordinates || (balloon.x !== undefined && balloon.y !== undefined);
                          const coords = balloon.coordinates || {
                            x: balloon.x || 0,
                            y: balloon.y || 0,
                            width: 50, // デフォルトの幅
                            height: 50, // デフォルトの高さ
                          };

                          return (
                            <tr
                              key={index}
                              onClick={() => {
                                if (onBalloonClick && hasCoordinates) {
                                  onBalloonClick(coords);
                                }
                              }}
                              className={`even:bg-me-grey-light ${
                                hasCoordinates && onBalloonClick
                                  ? 'cursor-pointer hover:bg-me-red hover:bg-opacity-10 transition-colors'
                                  : ''
                              }`}
                            >
                            <td className="px-3 py-2 text-sm text-me-grey-dark font-medium">
                              {balloon.upper_text ?? balloon.balloon_number ?? '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-me-grey-dark">
                              {balloon.lower_text ?? balloon.quantity?.toString() ?? '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-me-grey-dark">
                              {balloon.adjacent_text ? (
                                <span title={`位置: ${balloon.adjacent_position || '不明'}`}>
                                  {balloon.adjacent_text}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={getConfidenceColor(balloon.confidence)}>
                                {balloon.confidence}%
                              </span>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-me-grey-medium">
                    風船情報がありません
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-between items-center">
          <div className="space-x-2">
            {onApprove && (
              <button
                type="button"
                onClick={onApprove}
                disabled={disabled}
                className="px-4 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] disabled:bg-[#C4C4C4] disabled:cursor-not-allowed font-medium"
              >
                承認
              </button>
            )}
            {onReject && (
              <button
                type="button"
                onClick={onReject}
                disabled={disabled}
                className="px-4 py-3 bg-[#333333] text-white rounded-me hover:bg-[#555555] disabled:bg-[#C4C4C4] disabled:cursor-not-allowed font-medium"
              >
                却下
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="px-6 py-3 bg-[#FF0000] text-white rounded-me hover:bg-[#FF3333] disabled:bg-[#C4C4C4] disabled:cursor-not-allowed font-medium"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
