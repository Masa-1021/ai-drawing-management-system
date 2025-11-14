/**
 * 図面編集フォーム
 */

import { useForm } from 'react-hook-form';
import type { Drawing } from '../types/drawing';

interface EditFormProps {
  drawing: Drawing;
  onSave: (data: Partial<Drawing>) => void;
  onApprove?: () => void;
  onReject?: () => void;
  disabled?: boolean;
}

export default function EditForm({
  drawing,
  onSave,
  onApprove,
  onReject,
  disabled = false,
}: EditFormProps) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      classification: drawing.classification || '',
      summary: drawing.summary || '',
    },
  });

  const onSubmit = (data: Record<string, string>) => {
    onSave(data);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">基本情報</h3>

          <div className="space-y-4">
            {/* 分類 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分類
              </label>
              <select
                {...register('classification')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                要約
              </label>
              <textarea
                {...register('summary')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 抽出フィールド */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            抽出フィールド ({drawing.extracted_fields.length}件)
          </h3>

          <div className="space-y-3">
            {drawing.extracted_fields.map((field, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.field_name}
                  </label>
                  <input
                    type="text"
                    defaultValue={field.field_value}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                    <p className="text-xs text-red-600 mt-1">要確認</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 風船情報 */}
        {drawing.balloons.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">
              風船情報 ({drawing.balloons.length}件)
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      番号
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      部品名
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      数量
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      信頼度
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {drawing.balloons.map((balloon, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm">{balloon.balloon_number}</td>
                      <td className="px-3 py-2 text-sm">{balloon.part_name || '-'}</td>
                      <td className="px-3 py-2 text-sm">{balloon.quantity}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={getConfidenceColor(balloon.confidence)}>
                          {balloon.confidence}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex justify-between items-center">
          <div className="space-x-2">
            {onApprove && (
              <button
                type="button"
                onClick={onApprove}
                disabled={disabled}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                承認
              </button>
            )}
            {onReject && (
              <button
                type="button"
                onClick={onReject}
                disabled={disabled}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                却下
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
