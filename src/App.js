import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Clock, Circle, AlertTriangle, Loader } from 'lucide-react';

// --- 데이터 처리 함수들 ---

// CSV 텍스트를 JSON 객체 배열로 변환하는 함수
const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter(line => line);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const entry = {};
        headers.forEach((header, index) => {
            // 헤더 이름이 비어있는 경우를 대비하여 기본 키를 생성합니다.
            const key = header || `column_${index}`;
            entry[key] = values[index];
        });
        data.push(entry);
    }
    return { headers, data };
};

// 구글 시트 구조에 맞게 데이터를 변환하는 새로운 함수
const transformSheetData = (parsedData) => {
    const { headers, data } = parsedData;
    if (!data || data.length === 0) return { projectData: [], processSteps: [] };

    // WBS 단계에 해당하는 헤더를 동적으로 식별합니다.
    const infoColumns = ['TR', '제품군', '제품명', 'Gallery', 'Dimension', 'Install Video', 'FAQ', 'WBS Level', '비고', 'TotalModels'];
    // 실제 헤더 이름 대신, 동적으로 식별된 헤더를 사용합니다.
    const dynamicInfoHeaders = headers.filter(h => infoColumns.some(infoCol => h.includes(infoCol)));
    const processSteps = headers.filter(h => h && !dynamicInfoHeaders.includes(h) && h !== 'column_0' && h !== 'column_1' && h !== 'column_2');


    const groupedData = {};

    data.forEach(row => {
        // 헤더 이름 대신, CSV 열의 순서를 기준으로 데이터를 가져옵니다.
        const country = row[headers[0]] || 'Unknown Country';    // A열: TR (국가)
        const category = row[headers[1]] || 'Uncategorized';     // B열: 제품군
        const modelName = row[headers[2]] || 'Unknown Model';   // C열: 제품명
        
        // TotalModels가 시트에 없을 경우를 대비한 기본값 설정
        const totalModelsHeader = headers.find(h => h === 'TotalModels');
        const totalModels = totalModelsHeader ? parseInt(row[totalModelsHeader], 10) : 200;

        if (!groupedData[category]) {
            groupedData[category] = { category, totalModels, countries: {} };
        }

        if (!groupedData[category].countries[country]) {
            groupedData[category].countries[country] = { name: country, models: [] };
        }
        
        const wbsLevelHeader = headers.find(h => h === 'WBS Level');
        const wbsLevel = wbsLevelHeader ? row[wbsLevelHeader] : '미진행';

        const modelSteps = processSteps.map(stepName => ({
            name: stepName,
            status: row[stepName] || '미진행',
        }));

        groupedData[category].countries[country].models.push({
            name: modelName,
            wbsLevel: wbsLevel,
            steps: modelSteps
        });
    });
    
    const projectData = Object.values(groupedData).map(category => ({
        ...category,
        countries: Object.values(category.countries)
    }));

    return { projectData, processSteps };
};


const totalCountries = 32;

const calculateProgress = (items) => {
    if (!items || items.length === 0) return 0;
    const completedCount = items.filter(item => item.status === '완료').length;
    return Math.round((completedCount / items.length) * 100);
};

const StatusIndicator = ({ status }) => {
    const statusConfig = {
        '완료': { icon: <CheckCircle className="text-green-400" size={18} />, text: '완료' },
        '진행중': { icon: <Clock className="text-blue-400 animate-spin" size={18} />, text: '진행중' },
        '미진행': { icon: <Circle className="text-gray-500" size={18} />, text: '미진행' },
    };
    const config = statusConfig[status] || statusConfig['미진행'];
    return <div className="flex items-center justify-center" title={config.text}>{config.icon}</div>;
};

const StatusCell = ({ step }) => (
    <td className="p-2 border-b border-l border-gray-700 text-center relative group">
        <StatusIndicator status={step.status} />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {step.name}: {step.status}
        </div>
    </td>
);

const CountryProgressGrid = ({ country, processSteps }) => (
    <div className="overflow-x-auto p-4 bg-gray-800/50 rounded-b-lg">
        <h4 className="text-lg font-semibold text-gray-300 mb-3">{country.name}</h4>
        <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
                <tr className="bg-gray-700/70">
                    <th className="p-2 border-b border-gray-600 text-left w-[200px]">모델명</th>
                    <th className="p-2 border-b border-l border-gray-600 font-medium text-gray-300 w-[120px]">WBS Level</th>
                    {processSteps.map(step => <th key={step} className="p-2 border-b border-l border-gray-600 font-medium text-gray-300">{step}</th>)}
                </tr>
            </thead>
            <tbody>
                {country.models.map(model => (
                    <tr key={model.name} className="hover:bg-gray-700/50 transition-colors">
                        <td className="p-2 border-b border-gray-700 font-medium text-gray-200">{model.name}</td>
                        <td className="p-2 border-b border-l border-gray-700 text-center text-gray-300">{model.wbsLevel}</td>
                        {model.steps.map(step => <StatusCell key={step.name} step={step} />)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CategoryAccordion = ({ categoryData, processSteps }) => {
    const [isOpen, setIsOpen] = useState(true);
    const categoryProgress = useMemo(() => {
        const allSteps = categoryData.countries.flatMap(c => c.models.flatMap(m => m.steps));
        return calculateProgress(allSteps);
    }, [categoryData]);

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg mb-6">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-5 text-left">
                <div className="flex items-center">
                    {isOpen ? <ChevronDown size={24} className="mr-3 text-blue-400" /> : <ChevronRight size={24} className="mr-3 text-gray-400" />}
                    <h3 className="text-xl font-bold text-white">{categoryData.category} <span className="text-base font-normal text-gray-400">({categoryData.totalModels}개 모델)</span></h3>
                </div>
                <div className="flex items-center w-1/3">
                    <div className="w-full bg-gray-600 rounded-full h-2.5 mr-4"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${categoryProgress}%` }}></div></div>
                    <span className="font-semibold text-white">{categoryProgress}%</span>
                </div>
            </button>
            {isOpen && <div className="px-5 pb-5 space-y-4">{categoryData.countries.map(country => <CountryProgressGrid key={country.name} country={country} processSteps={processSteps} />)}</div>}
        </div>
    );
};

const SummaryCard = ({ title, value, total, progress, icon }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start">
                <h3 className="text-gray-400 font-semibold">{title}</h3>
                <div className="text-blue-400">{icon}</div>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{value} <span className="text-lg text-gray-500">/ {total}</span></p>
        </div>
        <div className="mt-4">
            <div className="w-full bg-gray-600 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
            <p className="text-right text-sm text-gray-300 mt-1">{progress}% 완료</p>
        </div>
    </div>
);

export default function App() {
    const [projectData, setProjectData] = useState([]);
    const [processSteps, setProcessSteps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 실시간 데이터 연동을 위한 구글 시트 CSV 내보내기 URL
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/1pcIGFJ7znGwlS0mwFwNGM1XUHf2Z_9NhbQ9wUSFeHI4/export?format=csv&gid=493994318';

        // CORS(Cross-Origin Resource Sharing) 문제를 우회하기 위해 프록시 서버를 사용합니다.
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const fetchUrl = proxyUrl + encodeURIComponent(sheetUrl);

        const fetchData = async () => {
            try {
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    throw new Error(`HTTP 오류! 상태: ${response.status}. URL이 정확한지, 시트가 '링크가 있는 모든 사용자가 볼 수 있음'으로 공유되었는지 확인하세요.`);
                }
                const csvText = await response.text();
                const parsedData = parseCSV(csvText);
                const { projectData: transformedProjectData, processSteps: dynamicProcessSteps } = transformSheetData(parsedData);
                
                setProjectData(transformedProjectData);
                setProcessSteps(dynamicProcessSteps);

            } catch (e) {
                console.error("데이터 로딩 실패:", e);
                setError(`데이터를 불러오는 데 실패했습니다: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const { overallProgress, completedTasks, totalTasks, totalModels, countryCount } = useMemo(() => {
        const allModels = projectData.flatMap(cat => cat.countries.flatMap(c => c.models));
        const allSteps = allModels.flatMap(m => m.steps);
        
        const uniqueCountries = new Set(projectData.flatMap(cat => cat.countries.map(c => c.name)));
        
        const uniqueModels = {};
        projectData.forEach(cat => {
            if (!uniqueModels[cat.category]) {
                uniqueModels[cat.category] = cat.totalModels;
            }
        });
        const totalModelCount = Object.values(uniqueModels).reduce((sum, models) => sum + models, 0);

        return {
            overallProgress: calculateProgress(allSteps),
            completedTasks: allSteps.filter(s => s.status === '완료').length,
            totalTasks: allSteps.length,
            totalModels: totalModelCount,
            countryCount: uniqueCountries.size
        };
    }, [projectData]);


    if (isLoading) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex flex-col justify-center items-center">
                <Loader className="animate-spin mb-4" size={48} />
                <p className="text-xl">구글 시트 데이터를 불러오는 중...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex flex-col justify-center items-center p-8">
                 <AlertTriangle className="text-yellow-400 mb-4" size={48} />
                <h2 className="text-2xl font-bold mb-2 text-red-500">데이터 로딩 오류</h2>
                <p className="text-center bg-gray-800 p-4 rounded-lg">{error}</p>
                 <p className="text-center mt-4 text-gray-400">구글 시트에서 [파일] {'>'} [공유] {'>'} [웹에 게시]를 통해 생성된 CSV 링크가 코드에 정확히 입력되었는지 확인해주세요.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-white tracking-tight">LG.com PDP 구매기여컨텐츠 개선 프로젝트</h1>
                    <p className="text-lg text-gray-400 mt-2">글로벌 확산 현황 대시보드</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <SummaryCard title="전체 진행률" value={completedTasks} total={totalTasks > 0 ? totalTasks : '...'} progress={overallProgress} icon={<CheckCircle size={24} />} />
                    <SummaryCard title="제품 카테고리" value={projectData.length} total={5} progress={Math.round(projectData.length / 5 * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>} />
                    <SummaryCard title="적용 국가" value={countryCount} total={totalCountries} progress={Math.round(countryCount / totalCountries * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>} />
                    <SummaryCard title="대상 모델" value={totalModels} total={440} progress={Math.round(totalModels / 440 * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>} />
                </div>

                <main>
                    {projectData.map(cat => <CategoryAccordion key={cat.category} categoryData={cat} processSteps={processSteps} />)}
                </main>
                <footer className="text-center mt-10 text-gray-500 text-sm">
                    <p>마지막 업데이트: {new Date().toLocaleString('ko-KR')}</p>
                </footer>
            </div>
        </div>
    );
}
