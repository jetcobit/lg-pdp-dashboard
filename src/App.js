import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Clock, Circle, AlertTriangle, Loader } from 'lucide-react';

// --- 데이터 처리 함수들 ---

// CSV 텍스트를 JSON 객체 배열로 변환하는 함수
const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const values = lines[i].split(',').map(v => v.trim());
        const entry = {};
        for (let j = 0; j < headers.length; j++) {
            entry[headers[j]] = values[j];
        }
        data.push(entry);
    }
    return data;
};

// 플랫 데이터를 대시보드에 맞는 중첩 구조로 변환하는 함수
const transformData = (flatData) => {
    const groupedData = {};

    flatData.forEach(row => {
        if (!row.Category) return;

        if (!groupedData[row.Category]) {
            groupedData[row.Category] = {
                category: row.Category,
                totalModels: parseInt(row.TotalModels, 10) || 0,
                countries: {}
            };
        }

        if (!groupedData[row.Category].countries[row.Country]) {
            groupedData[row.Category].countries[row.Country] = {
                name: row.Country,
                contents: {}
            };
        }

        if (!groupedData[row.Category].countries[row.Country].contents[row.ContentType]) {
            groupedData[row.Category].countries[row.Country].contents[row.ContentType] = {
                name: row.ContentType,
                steps: []
            };
        }

        groupedData[row.Category].countries[row.Country].contents[row.ContentType].steps.push({
            name: row.StepName,
            status: row.Status,
            targetDate: row.TargetDate
        });
    });

    return Object.values(groupedData).map(category => ({
        ...category,
        countries: Object.values(category.countries).map(country => ({
            ...country,
            contents: Object.values(country.contents)
        }))
    }));
};


const totalCountries = 32;
const contentTypes = ['Gallery', 'Dimension', 'Installation Guide Video', 'FAQ'];
// WBS 단계 업데이트
const processSteps = ['에셋 취합', '컨텐츠 제작', '법인 검토', '수정', '법무 검토', 'Authoring', 'Publishing'];

const calculateProgress = (items) => {
    if (!items || items.length === 0) return 0;
    const completedCount = items.filter(item => item.status === 'Completed').length;
    return Math.round((completedCount / items.length) * 100);
};

const StatusIndicator = ({ status }) => {
    const statusConfig = {
        'Completed': { icon: <CheckCircle className="text-green-400" size={18} />, text: '완료' },
        'In Progress': { icon: <Clock className="text-blue-400 animate-spin" size={18} />, text: '진행중' },
        'Not Started': { icon: <Circle className="text-gray-500" size={18} />, text: '미시작' },
    };
    const config = statusConfig[status] || statusConfig['Not Started'];
    return <div className="flex items-center justify-center" title={config.text}>{config.icon}</div>;
};

const StatusCell = ({ step }) => (
    <td className="p-2 border-b border-l border-gray-700 text-center relative group">
        <StatusIndicator status={step.status} />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            목표: {step.targetDate}
        </div>
    </td>
);

const CountryProgressGrid = ({ country }) => (
    <div className="overflow-x-auto p-4 bg-gray-800/50 rounded-b-lg">
        <h4 className="text-lg font-semibold text-gray-300 mb-3">{country.name}</h4>
        <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
                <tr className="bg-gray-700/70">
                    <th className="p-2 border-b border-gray-600 text-left w-1/5">컨텐츠 유형</th>
                    {processSteps.map(step => <th key={step} className="p-2 border-b border-l border-gray-600 font-medium text-gray-300">{step}</th>)}
                </tr>
            </thead>
            <tbody>
                {country.contents.map(content => (
                    <tr key={content.name} className="hover:bg-gray-700/50 transition-colors">
                        <td className="p-2 border-b border-gray-700 font-medium text-gray-200">{content.name}</td>
                        {content.steps.map(step => <StatusCell key={step.name} step={step} />)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CategoryAccordion = ({ categoryData }) => {
    const [isOpen, setIsOpen] = useState(true);
    const categoryProgress = useMemo(() => {
        const allSteps = categoryData.countries.flatMap(c => c.contents.flatMap(ct => ct.steps));
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
            {isOpen && <div className="px-5 pb-5 space-y-4">{categoryData.countries.map(country => <CountryProgressGrid key={country.name} country={country} />)}</div>}
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // --- 데모용 샘플 데이터 ---
        // 구글 시트에서 가져온 최신 데이터로 업데이트되었습니다.
        const sampleCsvData = `Category,TotalModels,Country,ContentType,StepName,Status,TargetDate
TV,200,영국 (UK),Gallery,에셋 취합,Completed,2025-07-09
TV,200,영국 (UK),Gallery,컨텐츠 제작,Completed,2025-07-14
TV,200,영국 (UK),Gallery,법인 검토,In Progress,2025-07-19
TV,200,영국 (UK),Gallery,수정,Not Started,2025-07-24
TV,200,영국 (UK),Gallery,법무 검토,Not Started,2025-07-29
TV,200,영국 (UK),Gallery,Authoring,Not Started,2025-08-04
TV,200,영국 (UK),Gallery,Publishing,Not Started,2025-08-09
TV,200,이탈리아 (Italy),Dimension,에셋 취합,Completed,2025-07-11
TV,200,이탈리아 (Italy),Dimension,컨텐츠 제작,In Progress,2025-07-21
TV,200,이탈리아 (Italy),Dimension,법인 검토,Not Started,2025-07-26
TV,200,이탈리아 (Italy),Dimension,수정,Not Started,2025-07-31
TV,200,이탈리아 (Italy),Dimension,법무 검토,Not Started,2025-08-05
TV,200,이탈리아 (Italy),Dimension,Authoring,Not Started,2025-08-10
TV,200,이탈리아 (Italy),Dimension,Publishing,Not Started,2025-08-15
모니터,30,프랑스 (France),Gallery,에셋 취합,Completed,2025-07-14
모니터,30,프랑스 (France),Gallery,컨텐츠 제작,Completed,2025-07-19
모니터,30,프랑스 (France),Gallery,법인 검토,In Progress,2025-07-24
모니터,30,프랑스 (France),Gallery,수정,Not Started,2025-07-29
모니터,30,프랑스 (France),Gallery,법무 검토,Not Started,2025-08-04
모니터,30,프랑스 (France),Gallery,Authoring,Not Started,2025-08-09
모니터,30,프랑스 (France),Gallery,Publishing,Not Started,2025-08-14
냉장고,100,스페인 (Spain),FAQ,에셋 취합,In Progress,2025-07-20
냉장고,100,스페인 (Spain),FAQ,컨텐츠 제작,Not Started,2025-07-30
냉장고,100,스페인 (Spain),FAQ,법인 검토,Not Started,2025-08-05
냉장고,100,스페인 (Spain),FAQ,수정,Not Started,2025-08-10
냉장고,100,스페인 (Spain),FAQ,법무 검토,Not Started,2025-08-15
냉장고,100,스페인 (Spain),FAQ,Authoring,Not Started,2025-08-20
냉장고,100,스페인 (Spain),FAQ,Publishing,Not Started,2025-08-25`;

        try {
            setIsLoading(true);
            const flatData = parseCSV(sampleCsvData);
            const transformed = transformData(flatData);
            setProjectData(transformed);
        } catch (e) {
            console.error("샘플 데이터 처리 오류:", e);
            setError(`샘플 데이터를 처리하는 중 오류가 발생했습니다: ${e.message}`);
        } finally {
            setIsLoading(false);
        }

        // --- 실제 구글 시트 연동 로직 ---
        // 구글 시트 URL이 준비되면 위 데모 로직을 지우고 아래 로직의 주석을 해제하여 사용하세요.
        /*
        const googleSheetCsvUrl = 'YOUR_GOOGLE_SHEET_CSV_URL_HERE';

        if (googleSheetCsvUrl === 'YOUR_GOOGLE_SHEET_CSV_URL_HERE') {
            setError('Google Sheet URL을 입력해주세요. 코드의 245번째 줄을 수정해야 합니다.');
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const response = await fetch(googleSheetCsvUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}. CORS 정책 문제일 수 있습니다.`);
                }
                const csvText = await response.text();
                const flatData = parseCSV(csvText);
                const transformed = transformData(flatData);
                setProjectData(transformed);
            } catch (e) {
                console.error("데이터 로딩 실패:", e);
                setError(`데이터를 불러오는 데 실패했습니다: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        */
    }, []);

    const overallProgress = useMemo(() => {
        const allSteps = projectData.flatMap(cat => cat.countries.flatMap(c => c.contents.flatMap(ct => ct.steps)));
        return calculateProgress(allSteps);
    }, [projectData]);
    
    const completedTasks = useMemo(() => {
        return projectData.flatMap(cat => cat.countries.flatMap(c => c.contents.flatMap(ct => ct.steps))).filter(s => s.status === 'Completed').length;
    }, [projectData]);

    const totalTasks = useMemo(() => {
         const allSteps = projectData.flatMap(cat => cat.countries.flatMap(c => c.contents.flatMap(ct => ct.steps)));
         return allSteps.length;
    }, [projectData]);

    const totalModels = useMemo(() => {
        const uniqueCategories = {};
        projectData.forEach(cat => {
            if (!uniqueCategories[cat.category]) {
                uniqueCategories[cat.category] = cat.totalModels;
            }
        });
        return Object.values(uniqueCategories).reduce((sum, models) => sum + models, 0);
    }, [projectData]);


    if (isLoading) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex flex-col justify-center items-center">
                <Loader className="animate-spin mb-4" size={48} />
                <p className="text-xl">프로젝트 데이터를 불러오는 중...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex flex-col justify-center items-center p-8">
                 <AlertTriangle className="text-yellow-400 mb-4" size={48} />
                <h2 className="text-2xl font-bold mb-2 text-red-500">오류 발생</h2>
                <p className="text-center bg-gray-800 p-4 rounded-lg">{error}</p>
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
                    <SummaryCard title="제품 카테고리" value={Object.keys(projectData.reduce((acc, cur) => ({...acc, [cur.category]: true}), {})).length} total={5} progress={Math.round(Object.keys(projectData.reduce((acc, cur) => ({...acc, [cur.category]: true}), {})).length / 5 * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>} />
                    <SummaryCard title="적용 국가" value={new Set(projectData.flatMap(p => p.countries.map(c => c.name))).size} total={totalCountries} progress={Math.round(new Set(projectData.flatMap(p => p.countries.map(c => c.name))).size / totalCountries * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>} />
                    <SummaryCard title="대상 모델" value={totalModels} total={440} progress={Math.round(totalModels / 440 * 100)} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>} />
                </div>

                <main>
                    {projectData.map(cat => <CategoryAccordion key={cat.category} categoryData={cat} />)}
                </main>
                <footer className="text-center mt-10 text-gray-500 text-sm">
                    <p>마지막 업데이트: {new Date().toLocaleString('ko-KR')}</p>
                </footer>
            </div>
        </div>
    );
}
