/**
 * ホームページ（ランディングページ）
 * 各機能への案内を表示
 */

import { Link } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SearchIcon from '@mui/icons-material/Search';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import TableChartIcon from '@mui/icons-material/TableChart';
import NumbersIcon from '@mui/icons-material/Numbers';
import SettingsIcon from '@mui/icons-material/Settings';
import { SvgIconProps } from '@mui/material';

interface FeatureCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactElement<SvgIconProps>;
}

function FeatureCard({ to, title, description, icon }: FeatureCardProps) {
  return (
    <Link
      to={to}
      className="block p-6 bg-white rounded-lg border border-me-grey-medium hover:border-me-red hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start space-x-4">
        <div className="text-me-red">{icon}</div>
        <div>
          <h3 className="text-lg font-bold text-me-grey-dark mb-2">{title}</h3>
          <p className="text-sm text-me-grey-dark">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const features = [
    {
      to: '/upload',
      title: 'アップロード',
      description: 'PDF図面をアップロードして、AIが自動で図枠情報を抽出・分類します。複数ファイルの一括アップロードにも対応。',
      icon: <CloudUploadIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/list',
      title: '図面一覧',
      description: '登録済みの図面を一覧表示。サムネイルで確認しながら、編集・承認・削除ができます。',
      icon: <ListAltIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/search',
      title: '検索',
      description: '自然言語で図面を検索。「モーターの組図」のような曖昧な検索にも対応します。',
      icon: <SearchIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/equipment',
      title: '設備一覧',
      description: 'ライン・設備の管理。OracleDBからのインポートや、設備ごとの図面紐付けができます。',
      icon: <PrecisionManufacturingIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/spec-sheets',
      title: '摘要表',
      description: '摘要表（Excel）のアップロード・管理。設備との紐付けや履歴管理ができます。',
      icon: <TableChartIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/spec-numbers',
      title: '摘番マスタ',
      description: '摘番（部品番号）のマスタ管理。一括インポートや検索ができます。',
      icon: <NumbersIcon sx={{ fontSize: 40 }} />,
    },
    {
      to: '/prompts',
      title: 'プロンプト設定',
      description: 'AI解析に使用するプロンプトの設定・カスタマイズができます。',
      icon: <SettingsIcon sx={{ fontSize: 40 }} />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヒーローセクション */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-me-grey-dark mb-4">
          図面管理システム
        </h1>
        <p className="text-lg text-me-grey-dark">
          AIを活用したCAD図面の自動解析・管理システム
        </p>
      </div>

      {/* 機能カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => (
          <FeatureCard key={feature.to} {...feature} />
        ))}
      </div>
    </div>
  );
}
