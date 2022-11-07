const functions = require("firebase-functions");
const admin = require('firebase-admin')
const FieldValue = admin.firestore.FieldValue
var moment = require('moment-timezone')
var numeral = require('numeral')
var timediff = require('timediff')
admin.initializeApp({ credential: admin.credential.applicationDefault() })
var db = admin.firestore()

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
////// ลาพักร้อน //////
exports.checkStartDate = functions.https.onCall(async (data, context) => {
    
    if (data != undefined) {
        var compId = data.compID
        var dateYear = new Date()
        // console.warn('dateYear', dateYear);
        var itemLevel = []
        var dataLevel = await db.collection(compId + 'Level').get()
            if (dataLevel.docs.length > 0) {
                for (const docLevel of dataLevel.docs) {
                    itemLevel.push(docLevel.data())
                    // console.log('itemLevel', itemLevel);
                }
            }

        var dataUser = await db.collection(compId + 'User').where('Status', '==', 1).get()

        if (dataUser.docs.length > 0) {
            var listUser = []
            for (const doc of dataUser.docs) {
                var item = doc.data()
                
                var startDate = item.WorkStartDate
                // console.log('xoxoxo', item.level);
                var listLevel = itemLevel.find((ele) => ele.LevelID == item.level)
                // console.log('listLevel', listLevel);
                
                var momentDiff = moment.tz(dateYear, 'Asia/Bangkok').diff(startDate, 'days', )
                // var TimeDiff = timediff(startDate, dateYear)
                // console.log('momentDiff', momentDiff);
                var dataTime = momentDiff % 365
                // console.log('dataTime', dataTime);
                
                if (dataTime == 0 ) {
                    var numberLevel = {}
                    if (listLevel != undefined) {
                        numberLevel = {
                            Day: listLevel.Day,
                            Hours: 0,
                            Minutes: 0,
                        }
                    }else{
                        numberLevel = {
                            Day: 0,
                            Hours: 0,
                            Minutes: 0,
                        }
                    }
                    db.collection(compId + 'User')
                      .doc(item.User_ID)
                      .update({New1GHp2IGLbnkeD7CV58KM: numberLevel})

                }
               
            }
        }
    }
    return "save"
});

exports.apiPayrollUser = functions.https.onCall(async (data, context) => {
    if (data != undefined) {
        const userId = data.userId //user id
        const compId = data.compId //company code
        const startDate = data.startDate //วันเริ่มต้นคิดเงิน
        const endDate = data.endDate //วันสิ้นสุดคิดเงิน
        const payDate = data.payDate //วันที่จ่ายเงิน
        const profileId = data.profileId // Standdard Profile กลุ่มพนักงาน
        const docUser = data.docUser
        var employeeTypeId = docUser.EmployeeTypeID // ประเภทพนักงาน 1 = รายเดือน 2 = รายวัน 3 = รายชม.
        const addMoneyExtra = data.addMoneyExtra //ถ้ามีเพิ่มเงินพิเศษ
        const addExpenseExtra = data.addExpenseExtra //ถ้ามีหักเงินพิเศษ
        const calNew = data.calNew //ถ้า เป็น 1 =สั่งคำนวนเงินเดือนใหม่

        //ถ้าเป็นceo ถือว่าเป็นรายเดือนทันที
        if (employeeTypeId == undefined || employeeTypeId == null) {
            employeeTypeId = 1
        }

        // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
        //     console.log('datadatadata เงินเดือน', docUser.Salary)
        // }

        var salary = docUser.Salary
        var income = 0
        var expense = 0
        var netmoney = 0
        var lateLeaveMoney = 0
        var listExtraMoney = {
            ExpenseHintTextList: [],
            ExpenseMoneyTextList: [],
            ExpenseNameTextList: [],
            IncomeHintTextList: [],
            IncomeMoneyTextList: [],
            IncomeNameList: [],
        }
      

        // console.log('Salary == ', salary);
        // console.log('docUser.SalaryDiligent', docUser.SalaryDiligent);
        // console.log('docUser.SalaryLiving', docUser.SalaryLiving);
        // console.log('docUser.SalaryPosition', docUser.SalaryPosition);
        // console.log('isNaN(Number(docUser.SalaryDiligent)))', isNaN(Number(docUser.SalaryDiligent)));
        // console.log('isNaN(Number(docUser.SalaryLiving)))', isNaN(Number(docUser.SalaryLiving)));
        // console.log('isNaN(Number(docUser.SalaryPosition)))', isNaN(Number(docUser.SalaryPosition)));
        //เบี้ยขยัน
        var SalaryDiligent = 0
        if (
            docUser.SalaryDiligent != undefined &&
            isNaN(Number(docUser.SalaryDiligent)) == false
        ) {
            SalaryDiligent = Number(docUser.SalaryDiligent)
        }
        //ค่าครองชีพ
        var SalaryLiving = 0
        if (
            docUser.SalaryLiving != undefined &&
            isNaN(Number(docUser.SalaryLiving)) == false
        ) {
            SalaryLiving = Number(docUser.SalaryLiving)
        }

        //ค่าตำแหน่ง
        var SalaryPosition = 0
        if (
            docUser.SalaryPosition != undefined &&
            isNaN(Number(docUser.SalaryPosition)) == false
        ) {
            SalaryPosition = Number(docUser.SalaryPosition)
        }

        var SalaryOT = 0 //ค่าโอที
        var SumOTHour = 0 //รวมชม.โอที

        var SalaryShift = 0 //ค่ากะ
        var SumShiftDay = 0 //รวมเข้ากะกี่วัน

        var _tmpDatePay = moment(payDate).format('YYYYMMDD')
        var _tmpDatePayMonthOnly = moment(payDate).format('YYYYMM')

        var docStandardProfile = await db
            .collection(compId + 'StandardProfile')
            .doc(profileId)
            .get()
        var _docStandardProfile = docStandardProfile.data()

        var docTaxDeduction = await db
            .collection(compId + 'TaxDeduction')
            .doc(userId + '_' + _tmpDatePay)
            .get()
        // var _docTaxDeduction = docTaxDeduction.data()
        // console.log('_docTaxDeduction', _docTaxDeduction)

        var docPayroll = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .get()

        var docPayrollMonth = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .get()

        if(docPayrollMonth.data() != undefined){
            var payrollMonth = docPayrollMonth.data()
            // console.log('payrollMonth Jay => ', payrollMonth.ExpenseHintTextList.length , payrollMonth.IncomeHintTextList.length);

            if(payrollMonth.ExpenseHintTextList.length > 0){
                for (let Ex = 0; Ex < payrollMonth.ExpenseHintTextList.length; Ex++) {
                    // console.log('loop Ex = ', Ex);
                    if(Ex > 5){
                        listExtraMoney['ExpenseHintTextList'].push(payrollMonth.ExpenseHintTextList[Ex])
                        listExtraMoney['ExpenseMoneyTextList'].push(payrollMonth.ExpenseMoneyTextList[Ex])
                        listExtraMoney['ExpenseNameTextList'].push(payrollMonth.ExpenseNameTextList[Ex])
                    }
                }
            }

            // console.log('listExtraMoney Jay => ', listExtraMoney);

            if(payrollMonth.IncomeHintTextList.length > 0){
                for (let In = 0; In < payrollMonth.IncomeHintTextList.length; In++) {
                    console.log('loop In = ', In);
                    if(In > 5){
                        listExtraMoney['IncomeHintTextList'].push(payrollMonth.IncomeHintTextList[In])
                        listExtraMoney['IncomeMoneyTextList'].push(payrollMonth.IncomeMoneyTextList[In])
                        listExtraMoney['IncomeNameList'].push(payrollMonth.IncomeNameList[In])
                    }
                }
            }

            // console.log('listExtraMoney Jay => ', listExtraMoney);
        }

        var dataForSavePayRoll = {}

        var profileTimeLate = 0 //กี่นาทีถึงจะเริ่มนับสาย
        if (_docStandardProfile.UseTimeLateCutMoney == '1') {
            profileTimeLate = _docStandardProfile.TimeLate
        }


        //คิดเงินแบบเดิม

        if (docPayroll.data() != undefined) {
            // console.log('xoxooxxo');
            var CountLate = 0 //นับครั้งมาสาย
            dataForSavePayRoll = docPayroll.data()

            

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )

            netmoney = Number(Number(income - expense).toFixed(2))

        } else {
            //ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้
            console.log('ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้')
            //ข้อมูลวันหยุดประจำปี
            var holidayData = {}
            if (moment(startDate).format('YYYY') == moment(endDate).format('YYYY')) {
                //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
                var _tmpHoliday = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData = _tmpHoliday.data()
            } else {
                //กรณีดึงข้อมูลข้ามปี
                var _tmpHolidayStart = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                var _tmpHolidayEnd = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData['Holiday'] = _tmpHolidayStart
                    .data()
                    .Holiday.concat(_tmpHolidayEnd.Holiday)
                holidayData['HolidayName'] = _tmpHolidayStart
                    .data()
                    .HolidayName.concat(_tmpHolidayEnd.HolidayName)
            }

            //นับวันที่ทำงาน ขาด ลา มาสาย
            const currentMomentPeruser = moment(startDate).locale('th')
            const endMomentPeruser = moment(endDate).locale('th').add(1, 'day')
            const checkIn = await getCheckIn(
                userId,
                compId,
                _docStandardProfile,
                startDate,
                endDate
            )
            const checkOut = await getCheckOut(userId, compId, startDate, endDate)
            const leaveDoc = await getLeave(userId, compId, startDate, endDate)
            const lateDoc = await getLate(userId, compId, startDate, endDate)
            
            console.log('Late Time Jay', lateDoc);
            //ดึงข้อมูล OT
            const overTimeDoc = await getOverTime(userId, compId, startDate, endDate)
            // console.log('overTimeDoc', overTimeDoc)

            //ดึงข้อมูลกะ
            // console.log('userId', userId)
            const employeeShitfDoc = await getEmployeeShitf(
                userId,
                compId,
                startDate,
                endDate
            )
            console.log('employeeShitfDoc', employeeShitfDoc)

            //ดึงข้อมูล ประกาศงาน
            const jobDoc = await getJob(userId, compId, startDate, endDate)
            console.log('jobDoc', jobDoc)

            var CountDateCheckIn = 0 //นับวันทำงาน
            var CountLate = 0 //นับครั้งมาสาย
            var SumLateTime = 0 //นับนาทีมาสาย
            var CountDateWeekend = 0 //นับวันหยุดประจำสัปดาห์
            var CountLeave = 0 //นับวันลา
            var CountNotWork = 0 //นับวันขาดงาน
            var CountHoliday = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var CountWeekendWork = 0 //นับวันทำงานที่เป็นวันหยุดประจำสัปดาห์
            var CountHolidayWork = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var SumMoneyWeekend = 0 //รวมเงินที่ทำงานวันหยุดประจำสัปดาห์
            var SumMoneyHoliday = 0 //รวมเงินที่ทำงานวันหยุดพิเศษ
            var SumDayNoMoney = 0 //รวมเงินลาประเภทที่ไม่ได้รับเงิน
            var arrLeave = [] //เก็บประเภทการลา

            //วนนับวันทำงาน
            while (currentMomentPeruser.isBefore(endMomentPeruser, 'day')) {
                var CountDayla = false  ////ตัวแปรเช็ควันลา
                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
                var timePleaseLate = 0
                var findLate = lateDoc.find((ele) => moment.tz(ele.DateTimeLate.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'))

                if(findLate != undefined){
                    var timeLateUser = moment.tz(findLate.DateTimeLate.toDate(), 'Asia/Bangkok').format('HH:mm')
                    var timeCheckInProfile = moment('2022-01-01 ' + _docStandardProfile.TimeIn).toDate()
                    var timeCheckInLate = moment('2022-01-01 ' + timeLateUser).toDate()

                    var diffLate = timediff(timeCheckInProfile, timeCheckInLate)
                    // console.warn('diffLate -> ', diffLate);
                    timePleaseLate = (diffLate.hours * 60) + diffLate.minutes
                }

                timePleaseLate = Number(timePleaseLate) + Number(profileTimeLate)

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//

                var _tmpCheckLate = false
                var checkInShow = '-'
                //หาเช็คอินแรกสุด
                var finded = checkIn.find(
                    (ele) =>
                        moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //หาเข็คเอ้าสุดท้าย เรียงเอ้าสุดท้ายจาก getCheckOut แล้ว
                var findedCheckOut = checkOut.find(
                    (ele) =>
                        moment(ele.CheckOutTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //ถ้ามีการเช็คอิน

                if (finded != undefined) {
                    //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                    var jobHave = false //พนักงานมีเข้างานในการประกาศงานหรือไม่
                    var jobLate = 0 //พนักงานเข้าสาย
                    var jobLateTime = 0 //พนักงานเข้าสายนาที
                    if (jobDoc.length > 0) {
                        //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                        var findedJob = jobDoc.find(
                            (ele) =>
                                ele.StartDate ==
                                moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->findedJob', findedJob);
                        if (findedJob != undefined) {
                            jobHave = true
                            var latediff = moment
                                .tz(finded.CheckInTime.toDate(), 'Asia/Bangkok')
                                .diff(
                                    moment.tz(
                                        findedJob.StartDate + ' ' + findedJob.StartTime,
                                        'Asia/Bangkok'
                                    ),
                                    'minutes'
                                )

                            finded['LateTimeMinite'] = latediff
                            // console.log('-->latediff', latediff);
                            if (latediff > timePleaseLate) {
                                jobLate = 1
                                jobLateTime = latediff
                            }
                        }
                    }

                    //ตรวจสอบว่าวันนี้มี กะหรือไม่
                    var shiftHave = false //พนักงานมีเข้างานในกะหรือไม่
                    var shiftLate = 0 //พนักงานเข้ากะแล้วสายครั้ง
                    var shiftLateTime = 0 //พนักงานเข้ากะสายนาที
                    if (employeeShitfDoc.length > 0) {
                        var findedShitf = employeeShitfDoc.find(
                            (ele) =>
                                ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        if (findedShitf != undefined) {
                            shiftHave = true
                            var latediff = moment
                                .tz(finded.CheckInTime.toDate(), 'Asia/Bangkok')
                                .diff(
                                    moment.tz(
                                        findedShitf.Day +
                                        ' ' +
                                        findedShitf.ShiftDetail.StartWorkingTime,
                                        'Asia/Bangkok'
                                    ),
                                    'minutes'
                                )
                            finded['LateTimeMinite'] = latediff
                            console.log('-->latediff', latediff)
                            if (latediff > timePleaseLate) {
                                shiftLate = 1
                                shiftLateTime = latediff
                            }
                        }
                    }

                    //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                    if (jobHave) {
                        //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (jobLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(jobLateTime)
                        }
                        if (shiftHave == true) {
                            //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                            SumShiftDay += 1
                            SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value)
                        }
                    } else if (shiftHave == true) {
                        //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                        SumShiftDay += 1
                        SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value)
                        //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (shiftLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(shiftLateTime)
                        }
                    } else {
                        //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                        //กรณีมีสาย
                        if (finded.LateCount != undefined) {
                            if(Number(finded.LateTimeMinite) > timePleaseLate){
                                lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(finded.LateTimeMinite)
                            }
                        }
                    }
                    //นับวันทำงาน
                    CountDateCheckIn++
                    checkInShow = moment(finded.CheckInTime.toDate()).format(
                        'เข้า HH:mm '
                    )
                }

                if (findedCheckOut != undefined) {
                    //กรณีมีเช็คอิน
                    checkInShow =
                        checkInShow +
                        moment(findedCheckOut.CheckOutTime.toDate()).format(' - ออก HH:mm')
                }

                //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                var _tmpThisWeekend = false
                if (
                    _docStandardProfile.Weeked.Mon == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Mon'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Tue == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Tue'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Wed == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Wed'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Thu == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Thu'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Fri == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Fri'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sat == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Sat'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sun == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Sun'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }

                //เช็คว่าเป็นวันหยุดพิเศษไหม
                var _findedHolidaData = holidayData.Holiday.find(
                    (ele) =>
                        ele ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                )

                //คำนวนโอที
                if (overTimeDoc.length > 0) {
                    var findedOverTime = overTimeDoc.find(
                        (ele) =>
                            moment
                                .tz(ele.StartDateTime.toDate(), 'Asia/Bangkok')
                                .format('YYYY-MM-DD') ==
                            moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )

                    var filterDataOT = overTimeDoc.filter((ele) => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                    )

                    if (filterDataOT.length > 0) {

                        var sumHoursOT = 0
                        var sumMinutesOT = 0
                        for (let indexOT = 0; indexOT < filterDataOT.length; indexOT++) {
                            var itemOT = filterDataOT[indexOT];
                            sumHoursOT += itemOT.sumHours
                            sumMinutesOT += itemOT.sumMinutes
                        }

                        var sumAllOT = Number(sumHoursOT + '.' + sumMinutesOT)

                        var _otType = 'โอทีวันทำงานปกติ'
                        if (_findedHolidaData != undefined) {
                            _otType = 'โอทีวันหยุดพิเศษ'
                        } else if (_tmpThisWeekend == true) {
                            _otType = 'โอทีวันหยุดประจำสัปดาห์'
                        }

                        if(shiftHave == true){
                            _otType = 'โอทีวันทำงานปกติ';
                        }

                        var _obj = {
                            salary: salary,
                            otHour: sumAllOT,
                            otType: _otType,
                            empType: employeeTypeId, //พนักงานรายวัน
                        }
                        console.log('==>__obj', _obj)
                        var _money = await calOTIncome(_docStandardProfile, _obj)
                        console.log('==>_money', _money)
                        SumOTHour += Number(sumAllOT)
                        SalaryOT += Number(_money)
                    }
                }

                //เช็คว่าลาหรือไม่
                var findedLeave = leaveDoc.find(
                    (ele) => moment(currentMomentPeruser).isBetween(moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD'), moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                )

                // console.log('findedLeave',findedLeave);
                if (findedLeave != undefined) {
                    // console.log('findedLeave', findedLeave);
                    if (findedLeave.LeaveTypeData.Wages == 'ไม่ได้รับค่าจ้าง') {
                        // console.log('EEEEE', findedLeave);
                        // console.log('RRRRR', arrLeave);
                        var findArrLeave = arrLeave.findIndex((ele) => ele.LeaveID == findedLeave.LeaveID)
                        // console.log('findArrLeave', findArrLeave);
                        if (findArrLeave == -1) {
                            var cutLeaveDay = 0
                            var cutLeaveHours = 0
                            var cutLeaveMinutes = 0
                            // console.log('findedLeave.Cut_Day', findedLeave.Cut_Day);
                            if (findedLeave.Cut_Day > 0) {
                                cutLeaveDay = (salary / 30) * findedLeave.Cut_Day
                                // console.log('วัน', cutLeaveDay);
                            }

                            if (findedLeave.Cut_Hours > 0) {
                            var LeaveHours = (salary / 30)
                            cutLeaveHours = LeaveHours / 9 * findedLeave.Cut_Hours
                            // console.log('ชั่วโมง', cutLeaveHours);
                            }
                            if (findedLeave.Cut_Minutes > 0) {
                                var LeaveMinutes = (salary / 30)
                                var _LeaveMinutes = LeaveMinutes / 9
                                cutLeaveMinutes = _LeaveMinutes / 2
                                // console.log('นาที', cutLeaveMinutes);
                            }

                            arrLeave.push(findedLeave)

                            var sumUnpaid = cutLeaveDay + cutLeaveHours + cutLeaveMinutes
                            // console.log('วันลาที่ไม่ได้เงิน', sumUnpaid);
                            
                            SumDayNoMoney += sumUnpaid
                            console.log('SumDayNoMoney', SumDayNoMoney);
                        }

                    }
                    CountLeave++

                    //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                    if (finded != undefined) {
                        CountDateCheckIn--
                        var _diffLeave = timediff(
                            findedLeave.StartDateTime.toDate(),
                            findedLeave.EndDateTime.toDate(),
                            'Hm'
                        )
                        var _tmpLeaveHour = ''
                        if (_diffLeave.hours < 9) {
                            _tmpLeaveHour =
                                '' + _diffLeave.hours + '.' + _diffLeave.minutes + ' ชม.' + '\n'
                        }

                        if (_tmpCheckLate == true) {
                            //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                            CountLate--
                            SumLateTime -= Number(finded.LateTimeMinite)
                        }
                    }

                    if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '1') {
                        // var getLeave = 
                        // console.log('ค่าแรงในวันลา');
                        CountDateCheckIn++
                    } else if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '0' || _docStandardProfile.UseLeaveMoney == undefined) {
                        console.log('ไม่ได้ค่าแรงในวันลา');
                    }
                } else {
                    //ถ้าไม่ใช่ลา
                    if (_tmpThisWeekend == false && checkInShow == '-') {
                        if (_findedHolidaData != undefined) {
                            //ถ้าเป็นวันหยุดพิเศษ ไม่นับว่าขาดงาน
                            if (checkInShow != '-') {
                                //ถ้ามีมาทำงานวันหยุดพิเศษให้นับวันจำนวนวันหยุดพิเศษ
                                CountHoliday++
                            }
                        } else {
                            //ถ้าเป็นวันทำงานปกติ ให้นับว่าขาด
                            if(checkInShow == '-'){
                                CountDayla = true
                                CountNotWork++
                            }
                        }
                    }
                }

                if (finded == undefined && _findedHolidaData == undefined) {
                    //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่
                    var findedShitf2 = employeeShitfDoc.find(
                        (ele) =>
                            ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )

                    if (findedShitf2 != undefined && findedLeave == undefined) {
                        //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                        if(CountDayla != true){
                            CountNotWork++
                        }
                    }
                }

                //ถ้ามีเช็คอินในวันหยุด หรือวันหยุดพิเศษ ให้นับวันทำงานด้วย
                if (finded != undefined) {
                    if (_findedHolidaData != undefined) {
                        //ถ้าวันนี้มาทำงานในวันหยุดพิเศษ จะนับวันทำงานด้วยเพื่อเอาไปคิดเงิน
                        CountHolidayWork++;
                    } else if (_tmpThisWeekend) {
                        var _findedHaveShitf = employeeShitfDoc.find(
                            (ele) =>
                                ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        if (_findedHaveShitf == undefined) {
                            //ต้องไม่เป็นกะ ถึงจะถือว่าเป็นการทำงานวันหยุดประจำสัปดาห์
                            //วันนี้เป็นวันหยุดประจำสัปดาห์
                            CountWeekendWork++;
                        }

                    }
                }

                currentMomentPeruser.add(1, 'days')
            }

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดประจำสัปดาห์หรือไม่
            if (_docStandardProfile.UsePayMoneyWeekend == '1') {
                var _typePayWeekend = _docStandardProfile.UsePayMoneyWeekendTypeID;
                if (_typePayWeekend == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyWeekend =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyWeekend =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyWeekend =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    }
                } else if (_typePayWeekend == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyWeekend = Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayWeekend == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyWeekend =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerHourBaht) *
                        Number(CountWeekendWork)
                }
            }

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดพิเศษหรือไม่
            if (_docStandardProfile.UsePayMoneyHoliday == '1') {
                var _typePayHoliday = _docStandardProfile.UsePayMoneyHolidayTypeID;
                if (_typePayHoliday == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyHoliday =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyHoliday =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyHoliday =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    }
                } else if (_typePayHoliday == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyHoliday = Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayHoliday == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyHoliday =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerHourBaht) *
                        Number(CountHolidayWork)
                }
            }


            //คำนวนเงินเดือน
            if (employeeTypeId == 2) {
                //พนักงานรายวัน
                salary = salary * CountDateCheckIn
            } else {
                //พนักงานรายเดือน
                salary = salary
            }

            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('datadatadata/////', salary)
            }

            console.log('CountLate', CountLate)
            console.log('SumLateTime', SumLateTime)

            //คิดเงินประกันสังคม ถ้าไม่ติ๊กใช้งานคือไม่คิดเงินประกันสังคม
            var resM33 = 0
            if (_docStandardProfile.UseCutM33 != undefined) {
                if (_docStandardProfile.UseCutM33 == 1) {
                    var dataCalM33 = {
                        salary: salary,
                        percent: Number(_docStandardProfile.M33Rate),
                    }
                    resM33 = calM33(dataCalM33)
                }
            }

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('CountNotWork -> ', CountNotWork)
            }

            var resAbsent = 0

            if (
                docUser.EmployeeTypeID == 1 ||
                docUser.EmployeeTypeName == 'พนักงานประจำ'
            ) {
                resAbsent = await calAbsent(
                    CountNotWork,
                    compId,
                    userId,
                    profileId,
                    salary,
                    SumLateTime
                )
            }

            var tax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }
            // console.log('docUser.TawitUse', docUser.TawitUse)

            //------------------คำนวณภาษีแบบเก่า--------------------//
            // if (docUser.TawitUse == 1) {
            //     //ถ้าคิดภาษีเงินได้บุคคลธรรมดา
            //     tax = await calTax({
            //         salary: salary,
            //         moneyPay: 100000,
            //         deduc: 60000,
            //         m33: resM33 * 12,
            //     })
            // }
            //------------------คำนวณภาษีแบบเก่า--------------------//

            //------------------วันลาที่ไม่ได้เงิน--------------------//
            // console.log('ตัดค่าวันอื่นๆ', resAbsent);
            // console.log('รวม', SumDayNoMoney.toLocaleString('th-TH', {maximumFractionDigits: 2, minimumFractionDigits: 2,}));
            if (SumDayNoMoney > 0) {
                resAbsent = Number(SumDayNoMoney) + Number(resAbsent)
                console.log('วันลาที่ไม่ได้เงิน', resAbsent);
            }
            
            //------------------วันลาที่ไม่ได้เงิน--------------------//
            

            dataForSavePayRoll = {
                ExpenseHintTextList: [
                    'ภาษี ' + numeral(tax.taxPerMonth).format('0,0.00') + ' บาท',
                    'WHT 0.00 บาท',
                    'ประกันสังคม ' + numeral(resM33).format('0,0.00') + ' บาท',
                    'สายขาดลา ' + numeral(resAbsent).format('0,0.00') + ' บาท',
                    'หักอื่นๆ 0.00 บาท',
                    'รายได้รับล่วงหน้า 0.00 บาท',
                ],
                ExpenseMoneyTextList: [
                    '' + tax.taxPerMonth,
                    '0.00',
                    '' + resM33,
                    '' + resAbsent,
                    '0.00',
                    '0.00',
                ],
                ExpenseNameTextList: [
                    'ภาษี',
                    'WHT',
                    'ประกันสังคม',
                    'สายขาดลา',
                    'หักอื่นๆ',
                    'รายได้รับล่วงหน้า',
                ],
                IncomeHintTextList: [
                    'เงินเดือน ' + numeral(salary).format('0,0.00') + ' บาท',
                    'เบี้ยขยัน 0.00 บาท',
                    'โอที 0.00 บาท',
                    'คอมมิชชั่น 0.00 บาท',
                    'โบนัส 0.00 บาท',
                    'รายได้อื่นๆ 0.00 บาท',
                ],
                IncomeMoneyTextList: [
                    '' + salary,
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                ],
                IncomeNameList: [
                    'เงินเดือน',
                    'เบี้ยขยัน',
                    'โอที',
                    'คอมมิชชั่น',
                    'โบนัส',
                    'รายได้อื่นๆ',
                ],
                OtherHintTextList: [
                    'รายได้สะสม 0.00 บาท',
                    'ภาษีสะสม 0.00 บาท',
                    'WHT สะสม 0.00 บาท',
                    'ประกันสังคมสะสม 0.00 บาท',
                ],
                OtherMoneyTextList: ['0.00', '0.00', '0.00', '0.00'],
                OtherNameTextList: [
                    'รายได้สะสม',
                    'ภาษีสะสม',
                    'WHT สะสม',
                    'ประกันสังคมสะสม',
                ],
                SetUserId: userId,
            }

            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////

            if(listExtraMoney.ExpenseHintTextList.length > 0){
                dataForSavePayRoll['ExpenseHintTextList'].push(...listExtraMoney.ExpenseHintTextList)
            }
            if(listExtraMoney.ExpenseMoneyTextList.length > 0){
                dataForSavePayRoll['ExpenseMoneyTextList'].push(...listExtraMoney.ExpenseMoneyTextList)
            }
            if(listExtraMoney.ExpenseNameTextList.length > 0){
                dataForSavePayRoll['ExpenseNameTextList'].push(...listExtraMoney.ExpenseNameTextList)
            }

            if(listExtraMoney.IncomeHintTextList.length > 0){
                dataForSavePayRoll['IncomeHintTextList'].push(...listExtraMoney.IncomeHintTextList)
            }
            if(listExtraMoney.IncomeMoneyTextList.length > 0){
                dataForSavePayRoll['IncomeMoneyTextList'].push(...listExtraMoney.IncomeMoneyTextList)
            }
            if(listExtraMoney.IncomeNameList.length > 0){
                dataForSavePayRoll['IncomeNameList'].push(...listExtraMoney.IncomeNameList)
            }
            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////
            

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('resAbsent -> ', resAbsent)
            }

            if (SalaryOT > 0 && SumOTHour > 0) {
                dataForSavePayRoll.IncomeHintTextList[2] =
                    'โอที ' + numeral(Number(SalaryOT)).format('0,0.00') + ' บาท'
                dataForSavePayRoll.IncomeMoneyTextList[2] =
                    '' + numeral(Number(SalaryOT)).format('0.00')
            }

            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('datadatadata/////ฟฟฟฟฟฟฟฟ', salary)
            }

            // income = salary;
            // expense = Number(tax.taxPerMonth) + Number(resM33);

            if (addMoneyExtra != undefined) {
                //ถ้ามีสั่งเพิ่มเงินพิเศษ
                dataForSavePayRoll.IncomeHintTextList.push(
                    addMoneyExtra.Name +
                    ' ' +
                    numeral(Number(addMoneyExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.IncomeMoneyTextList.push(
                    numeral(Number(addMoneyExtra.Money)).format('0.00')
                )
                dataForSavePayRoll.IncomeNameList.push(addMoneyExtra.Name)
            }

            if (addExpenseExtra != undefined) {
                //ถ้ามีสั่งหักเงินพิเศษ
                dataForSavePayRoll.ExpenseHintTextList.push(
                    addExpenseExtra.Name +
                    ' ' +
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.ExpenseMoneyTextList.push(
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00')
                )
                dataForSavePayRoll.ExpenseNameTextList.push(addExpenseExtra.Name)
            }

            //เช็กเพื่อเติมเบี้ยขยันก่อน
            //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
            console.log('==>SalaryDiligent', SalaryDiligent)
            if (SalaryDiligent > 0) {
                dataForSavePayRoll.IncomeHintTextList[1] =
                    'เบี้ยขยัน ' +
                    numeral(Number(SalaryDiligent)).format('0,0.00') +
                    ' บาท'
                dataForSavePayRoll.IncomeMoneyTextList[1] =
                    '' + numeral(Number(SalaryDiligent)).format('0.00')
            }
            console.log('==>SalaryLiving', SalaryLiving)
            //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
            if (SalaryLiving > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่าครองชีพ'
                )
                console.log('==>finded', finded)
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าครองชีพ ' +
                        numeral(Number(SalaryLiving)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryLiving)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                } else {
                    //ถ้ามี
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่าครองชีพ ' +
                        numeral(Number(SalaryLiving)).format('0,0.00') +
                        ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryLiving)).format('0.00')
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                }
            }

            //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
            console.log('==>SalaryPosition', SalaryPosition)
            if (SalaryPosition > 0) {
                //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่าตำแหน่ง'
                )
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าตำแหน่ง ' +
                        numeral(Number(SalaryPosition)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryPosition)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                } else {
                    //ถ้ามี
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่าตำแหน่ง ' +
                        numeral(Number(SalaryPosition)).format('0,0.00') +
                        ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryPosition)).format('0.00')
                }
            }

            //ถ้ามีรายได้ค่ากะ ให้เติมข้อมูลใน array
            if (SalaryShift > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่ากะ'
                )
                console.log('==>finded', finded)
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryShift)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่ากะ')
                } else {
                    //ถ้ามี
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryShift)).format('0.00')
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                }
            }

            // หักเงินมาสาย
            if (CountLate > 0 && SumLateTime > 0) {
                //ถ้ากลุ่มนี้มีตั้งเงื่อนไขสายแล้วหักเงิน
                if (_docStandardProfile.UseTimeLateCutMoney == '1') {
                    if (SumLateTime > 0) {
                        var lateMinite = SumLateTime
                        var late = 1

                        //เช็คว่าใช้ เงื่อนไขหักเงินมาสายจากเบี้ยขยัน ค่าครองชีพ ค่าตำแหน่ง หรือไม่
                        if (_docStandardProfile.UseTimeLateCutMoneyExtra == '1') {
                            if (_docStandardProfile.chipExtraMoney != undefined) {
                                var moneyForCutLate = 0 //จำนวนเงินสำหรับตัด
                                if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                    //หักเป็นบาท ต่อ ชม.
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate =
                                        Number(_lateHour) *
                                        Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                } else if (
                                    _docStandardProfile.UseTimeLateCutMoneyTypeID == '2'
                                ) {
                                    //หักสูตรคิดเงินเดือน
                                    var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_moneyPerDay)
                                }
                                //เอามาเช็คว่าใน array มีการเพิ่มค่าเบี้ยเลี้ยง ค่าครองชีพ ค่าตำแหน่ง เข้าไปใน array หรือยัง ถ้ายัง ให้เอาให้เพิ่มต่อกรณีที่มีการกำหนดจำนวนเงินมา
                                var checkHaveSalaryDiligent = false
                                var checkHaveSalaryLiving = false
                                var checkHaveSalaryPosition = false
                                if (moneyForCutLate > 0) {
                                    //ให้ทำการ วน ตัดจากลำดับที่เลือกไว้
                                    for (
                                        var ic = 0; ic < _docStandardProfile.chipExtraMoney.length; ic++
                                    ) {
                                        var chipExtra = _docStandardProfile.chipExtraMoney[ic]
                                        if (chipExtra == 'เบี้ยขยัน' && SalaryDiligent > 0) {
                                            console.log('chipExtra', chipExtra)
                                            //เบี้ยขยันลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryDiligent > moneyForCutLate) {
                                                checkHaveSalaryDiligent = true
                                                //ถ้าเบี้ยขยัน > เงินที่ตั้งตัด
                                                result = SalaryDiligent - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList[1] =
                                                    'เบี้ยขยัน ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                dataForSavePayRoll.IncomeMoneyTextList[1] =
                                                    '' + numeral(Number(result)).format('0.00')

                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                checkHaveSalaryDiligent = true
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryDiligent
                                                dataForSavePayRoll.IncomeHintTextList[1] =
                                                    'เบี้ยขยัน ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                dataForSavePayRoll.IncomeMoneyTextList[1] =
                                                    '' + numeral(Number(result)).format('0.00')
                                            }
                                        } else if (chipExtra == 'ค่าครองชีพ' && SalaryLiving > 0) {
                                            console.log('chipExtra', chipExtra)
                                            //ค่าครองชีพลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryLiving > moneyForCutLate) {
                                                checkHaveSalaryLiving = true
                                                //ถ้าค่าครองชีพ > เงินที่ตั้งตัด
                                                result = SalaryLiving - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าครองชีพ ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryLiving = true
                                                moneyForCutLate = moneyForCutLate - SalaryLiving
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าครองชีพ ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                            }
                                        } else if (
                                            chipExtra == 'ค่าตำแหน่ง' &&
                                            SalaryPosition > 0
                                        ) {
                                            console.log('chipExtra', chipExtra)
                                            //ค่าตำแหน่งลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryPosition > moneyForCutLate) {
                                                checkHaveSalaryPosition = true
                                                //ถ้าค่าตำแหน่ง > เงินที่ตั้งตัด
                                                result = SalaryPosition - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าตำแหน่ง ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryPosition = true
                                                moneyForCutLate = moneyForCutLate - SalaryPosition
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าตำแหน่ง ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                            }
                                        } else if (chipExtra == 'เงินเดือน') {
                                            console.log('chipExtra', chipExtra)
                                            //เบี้ยขยันลบเงินที่มาสาย
                                            var result = 0
                                            result = salary - moneyForCutLate
                                            console.log(
                                                'result',
                                                numeral(Number(result)).format('0,0.00')
                                            )

                                            dataForSavePayRoll.IncomeHintTextList[0] =
                                                'เงินเดือน ' +
                                                numeral(Number(result)).format('0,0.00') +
                                                ' บาท'
                                            dataForSavePayRoll.IncomeMoneyTextList[0] = numeral(
                                                Number(result)
                                            )
                                                .format('0.00')
                                                .toString()
                                            console.log(
                                                'dataForSavePayRoll.IncomeMoneyTextList[0]',
                                                dataForSavePayRoll.IncomeMoneyTextList[0]
                                            )

                                            break //ตัดปกติจบ ตัดรอบเดียว
                                        }
                                    }
                                }

                                //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                                if (checkHaveSalaryDiligent == false && SalaryDiligent > 0) {
                                    dataForSavePayRoll.IncomeHintTextList[1] =
                                        'เบี้ยขยัน ' +
                                        numeral(Number(SalaryDiligent)).format('0,0.00') +
                                        ' บาท'
                                    dataForSavePayRoll.IncomeMoneyTextList[1] =
                                        '' + numeral(Number(SalaryDiligent)).format('0.00')
                                }

                                //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                                if (checkHaveSalaryLiving == false && SalaryLiving > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push(
                                        'ค่าครองชีพ ' +
                                        numeral(Number(SalaryLiving)).format('0,0.00') +
                                        ' บาท'
                                    )
                                    dataForSavePayRoll.IncomeMoneyTextList.push(
                                        '' + numeral(Number(SalaryLiving)).format('0.00')
                                    )
                                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                }

                                //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                                if (checkHaveSalaryPosition == false && SalaryPosition > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push(
                                        'ค่าตำแหน่ง ' +
                                        numeral(Number(SalaryPosition)).format('0,0.00') +
                                        ' บาท'
                                    )
                                    dataForSavePayRoll.IncomeMoneyTextList.push(
                                        '' + numeral(Number(SalaryPosition)).format('0.00')
                                    )
                                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                }
                            }
                        } else {
                            //ถ้าไม่ได้ตั้งหักตามลำดับ

                            if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                //หักเป็นบาท ต่อ ชม.
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney =
                                    Number(_lateHour) *
                                    Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                dataForSavePayRoll.ExpenseHintTextList[3] =
                                    'สายขาดลา ' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') +
                                    ' บาท'
                                dataForSavePayRoll.ExpenseMoneyTextList[3] =
                                    '' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0.00')
                            } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                //หักสูตรคิดเงินเดือน
                                var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_moneyPerDay)
                                dataForSavePayRoll.ExpenseHintTextList[3] =
                                    'สายขาดลา ' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') +
                                    ' บาท'
                                dataForSavePayRoll.ExpenseMoneyTextList[3] =
                                    '' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0.00')
                            }
                        }
                    }
                } else {
                    //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                    if (SalaryDiligent > 0) {
                        dataForSavePayRoll.IncomeHintTextList[1] =
                            'เบี้ยขยัน ' +
                            numeral(Number(SalaryDiligent)).format('0,0.00') +
                            ' บาท'
                        dataForSavePayRoll.IncomeMoneyTextList[1] =
                            '' + numeral(Number(SalaryDiligent)).format('0.00')
                    }

                    //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                    if (SalaryLiving > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push(
                            'ค่าครองชีพ ' +
                            numeral(Number(SalaryLiving)).format('0,0.00') +
                            ' บาท'
                        )
                        dataForSavePayRoll.IncomeMoneyTextList.push(
                            '' + numeral(Number(SalaryLiving)).format('0.00')
                        )
                        dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                    }

                    //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                    if (SalaryPosition > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push(
                            'ค่าตำแหน่ง ' +
                            numeral(Number(SalaryPosition)).format('0,0.00') +
                            ' บาท'
                        )
                        dataForSavePayRoll.IncomeMoneyTextList.push(
                            '' + numeral(Number(SalaryPosition)).format('0.00')
                        )
                        dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                    }
                }
            }

            if (SumMoneyWeekend > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุด ' +
                        numeral(Number(SumMoneyWeekend)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyWeekend)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุด')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            }

            if (SumMoneyHoliday > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุดพิเศษ ' +
                        numeral(Number(SumMoneyHoliday)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyHoliday)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุดพิเศษ')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            //---------------------คำนวณภาษีแบบใหม่--------------------//
            var newTax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }
            if(docUser.TawitUse == 1){
                newTax = await calTax({
                    compId: compId,
                    salary: income,
                    moneyPay: 100000,
                    deduc: 60000,
                    m33: resM33 * 12,
                })
                // console.log('newTax -> ', newTax);
                dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(newTax.taxPerMonth)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(newTax.taxPerMonth)).format('0.00');

                if(Number(newTax.taxPerMonth) > 0){
                    expense += Number(newTax.taxPerMonth)
                }
            }
            //---------------------คำนวณภาษีแบบใหม่--------------------//

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            var RetainedIncome = 0
            var accumulatedTax = 0
            var cumulativeWHT = 0
            var socialSecurity = 0
            //คิวรี่ PayrollTransferSuccess เพื่อหารายได้สะสมของพนักงานแต่ละคน
            await db.collection(compId + 'PayrollTransferSuccess')
                .orderBy('Timestamp', "desc")
                .limit(1)
                .get()
                .then(async(querySnapshot) => {
                    console.log('xoxoxoxo', querySnapshot.docs.length);
                    if (querySnapshot.docs.length > 0) {

                            var itemPayrollTransfer = querySnapshot.docs[0].data()
                            
                            var docTransfer = itemPayrollTransfer.Transfer.filter((ele) => ele.UserID == userId)
                            console.log('docTransfer', docTransfer);
                            if (docTransfer.length > 0) {
                                docTransfer.sort((a, b) => a.PayDate.localeCompare(b.PayDate))
                                  console.log('>>>>>>', docTransfer);
                                var itemTransfer = docTransfer[docTransfer.length-1]
                                // console.log('>>>>>>>>>>>', itemTransfer);
                                /// split EndDate
                                var splitTimeStamp = itemTransfer.EndDate.split('-')
                                
                                var arMonth = splitTimeStamp[1]
                                // var arYear = splitTimeStamp[0]
                                // var arDay = splitTimeStamp[2]

                                ///split PayDate
                                var split_payDate = itemTransfer.PayDate.split('-')
                                var arYearPayDate = split_payDate[0]
                                var arMonthPayDate = split_payDate[1]
                                var arDayPayDate = split_payDate[2]

                                var convert_payDate = moment(payDate).toDate()
                                var convertPayDate = moment(itemTransfer.PayDate).toDate()
                                // console.log('%%%%%%%%%', convert_payDate, convertPayDate);
                                // console.log('@@@@@@@@@', payDate, itemTransfer.PayDate);

                                if (payDate != itemTransfer.PayDate && convert_payDate > convertPayDate) {

                                    var dataPayDate = itemTransfer.UserID + '_' + arYearPayDate + arMonthPayDate + arDayPayDate
                                    console.log('xoxoxoxo', dataPayDate);
                                    await db.collection(compId + 'Payroll')
                                    .doc(dataPayDate)
                                    .get()
                                    .then(async(queryPayroll) => {
                                        if (queryPayroll.data() != undefined ) {
                                            var item_Payroll = queryPayroll.data()
                                            var oSalary = item_Payroll.OtherMoneyTextList[0]
                                            // console.warn('AAA', oSalary);
                                            var oTax = item_Payroll.OtherMoneyTextList[1]
                                            // console.warn('BBB', oTax);
                                            var oWHT = item_Payroll.OtherMoneyTextList[2]
                                            // console.warn('CCC', oWHT);
                                            var oSocialMoney = item_Payroll.OtherMoneyTextList[3]
                                            // console.warn('DDD', oSocialMoney);
                                            // console.log('income', income);
                                            RetainedIncome = Number(oSalary) + income
                                            // console.log('รายได้สะสม', RetainedIncome);
                                            accumulatedTax = Number(oTax) + Number(dataForSavePayRoll.ExpenseMoneyTextList[0])
                                            // console.log('ภาษีสะสม', accumulatedTax);
                                            cumulativeWHT = Number(oWHT) + Number(dataForSavePayRoll.ExpenseMoneyTextList[1])
                                            // console.log('WHT สะสม', cumulativeWHT);
                                            socialSecurity = Number(oSocialMoney) + Number(dataForSavePayRoll.ExpenseMoneyTextList[2])

                                            // console.log('ประกันสังคมสะสม', socialSecurity);
                                            
                                            // console.log('======>', dataForSavePayRoll);
                                            var splitEndDate = endDate.split('-')
                                            var startMonth = splitEndDate[1]
                                            // console.log('&&&&&&', startMonth);

                                            if (startMonth == '01' && arMonth != '01') {
                                                console.log('####### else');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                                            }else{
                                                console.log('******* else');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(RetainedIncome)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(RetainedIncome)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(accumulatedTax)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(accumulatedTax)).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(cumulativeWHT)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(cumulativeWHT)).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(socialSecurity)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(socialSecurity)).format('0.00');
                                            }
                                        }
                                    })
                                }

                                
                            }else{
                                console.log('A++++++++++++++++++++A+++else');
                                // รายได้สะสม
                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                // ภาษีสะสม
                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                // WHT สะสม
                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                // ประกันสังคมสะสม
                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                            }   
                    }else{
                        console.log('B++++++++++++++++++++B+++else');
                        // รายได้สะสม
                        dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                        // ภาษีสะสม
                        dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                        // WHT สะสม
                        dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                        // ประกันสังคมสะสม
                        dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                    }
                })

            netmoney = Number(Number(income - expense).toFixed(2))

            // if (userId == '1654051178379zqm3') {
            //     console.log('CountNotWork ยังไม่ได้ทำ -> ', CountNotWork)
            // }
        }

        // console.log('dataForSavePayRoll', dataForSavePayRoll);

        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .set(dataForSavePayRoll)

        //ใส่ข้อมูลเบิ้ลเพื่อเอาไปแสดงในแอพด้วย
        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .set(dataForSavePayRoll)

        console.log('บันทึกข้อมูล', userId);

        await db
            .collection(compId + 'User')
            .doc(userId)
            .update({ LateTime: CountLate })

        var result = {
            income: income,
            expense: expense,
            netmoney: netmoney,
            userId: userId,
            compId: compId,
            startDate: startDate,
            endDate: endDate,
            payDate: payDate,
            tmpDatePay: _tmpDatePay,
            CountNotWork: CountNotWork,
        }

        // console.warn('data RETURN', result);

        return result
    } else {
        return 'no data send'
    }
})

function calM33(data) {
    if (data != undefined) {
        const salary = data.salary //เงินเดือน
        const percent =
            data.percent == undefined || data.percent == null ? 5 : data.percent //หักประกันสังคม %

        const maxBaht = data.maxBaht //ล็อกให้สูงสุดต้องจ่ายเป็นจำนวนบาท
        var result = 0.0
        //คิด ม33 ต้องปัดเศษถ้าเกิน .50 ให้ปัดเป็น 1 บาท ถ้าต่ำกว่า .50 ให้ปัดทิ้ง
        if (salary >= 1650.0 && salary < 15000.0) {
            result = Math.round(salary * (percent / 100))
        } else if (salary >= 15000.0) {
            result = Math.round((15000.0 * percent) / 100)
        }
        return Number(result.toFixed(2))
    } else {
        return 'no data send'
    }
}

function calAbsent(
    countAbsent,
    compId,
    userId,
    profileId,
    salary,
    SumLateTime
) {
    return new Promise((resolve) => {
        db.collection(compId + 'StandardProfile')
            .doc(profileId)
            .get()
            .then((docProfile) => {
                var item = docProfile.data()
                var sumAbsent = 0
                var lateMinite = SumLateTime
                var late = 1
                // console.log('UseMissingCutMoneyTypeID -> ', item.UseMissingCutMoneyTypeID);
                // console.log('UseMissingCutMoneyTypeIDPerBaht -> ', item.UseMissingCutMoneyTypeIDPerBaht);

                // var moneyForCutLate = 0; //จำนวนเงินสำหรับตัด
                // if(item.UseTimeLateCutMoneyExtra != '1'){
                //     if (item.UseTimeLateCutMoneyTypeID == '1') {
                //         //หักเป็นบาท ต่อ ชม.
                //         var _lateHour = (Number(late) * lateMinite) / 60
                //         moneyForCutLate = Number(_lateHour) * Number(item.UseTimeLateCutMoneyTypeIDPerBaht)

                //     } else if (item.UseTimeLateCutMoneyTypeID == '2') {
                //         //หักสูตรคิดเงินเดือน
                //         var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                //         var _lateHour = (Number(late) * lateMinite) / 60
                //         moneyForCutLate = Number(_lateHour) * Number(_moneyPerDay)
                //     }
                // }
                // console.log('AAAAAA', item);
                console.log('BBBBBB', item.UseMissingCutMoneyTypeIDPerBaht);
                if (item.UseMissingCutMoney == '1') {
                    if (item.UseMissingCutMoneyTypeID == '1') {
                        sumAbsent =
                            countAbsent * Number(item.UseMissingCutMoneyTypeIDPerBaht)
                        console.log('sumAbsent -> ', sumAbsent)
                        // resolve(sumAbsent);
                    } else {
                        sumAbsent = (salary / 30) * countAbsent
                        // resolve(sumAbsent);
                    }
                }

                // if(userId == 'brZVFEXwSOmgAJMe9Hos'){
                //     console.log('resolveresolve -> ', sumAbsent, moneyForCutLate);
                // }

                // var result = Number(sumAbsent) + Number(moneyForCutLate);

                resolve(sumAbsent)
            })
    })
}

function calTax(data) {
    if (data != undefined) {
        const _compId = data.compId
        const salary = data.salary //เงินเดือน
        const moneyPay = data.moneyPay //หักค่าใช้จ่าย
        const deduc = data.deduc //หักค่าลดหย่อน
        const m33 = data.m33 //หักค่าลดหย่อน
        var tax = 0.0

        console.log('รายการ -> ', salary, moneyPay, deduc, m33);
        var amount = salary * 12 - moneyPay - deduc - m33
        console.log('เงินทั้งหมดที่ใช้คำนวน -> ', amount);

        var vatCutPercent = 0
        if (amount <= 150000) { // 0 - 150k
            vatCutPercent = 0
            tax = 0.0
        } else if (amount > 150000 && amount <= 300000) { //150k - 300k ไม่เกิน 7,500
            vatCutPercent = 5
            tax = (amount - 150000) * (5 / 100)
            tax = tax > 7500 ? 7500 : tax
        } else if (amount > 300000 && amount <= 500000) { // 300k - 500k + 7,500 ไม่เกิน 27,500
            vatCutPercent = 10
            tax = (amount - 300000) * (10 / 100) + 7500
            tax = tax > 27500 ? 27500 : tax
        } else if (amount > 500000 && amount <= 750000) { // 500k - 750k + 27,500 ไม่เกิน 65,000
            vatCutPercent = 15
            tax = (amount - 500000) * (15 / 100) + 27500
            tax = tax > 65000 ? 65000 : tax
        } else if (amount > 750000 && amount <= 1000000) { // 750k - 1m + 65,000 ไม่เกิน 115,000
            vatCutPercent = 20
            tax = (amount - 750000) * (20 / 100) + 65000
            tax = tax > 115000 ? 115000 : tax
        } else if (amount > 1000000 && amount <= 2000000) { // 1m - 2m + 115,000 ไม่เกิน 365,000
            vatCutPercent = 25
            tax = (amount - 1000000) * (25 / 100) + 115000
            tax = tax > 365000 ? 365000 : tax
        } else if (amount > 2000000 && amount <= 5000000) { // 2m - 5m + 365,000 ไม่เกิน 1,265,000
            vatCutPercent = 30
            tax = (amount - 2000000) * (30 / 100) + 365000
            tax = tax > 1265000 ? 1265000 : tax
        } else if (amount > 5000000){ // 5m > + 1,265,000 มากกว่า 1,265,000 แน่นอน
            vatCutPercent = 35
            tax = (amount - 5000000) * (35 / 100) + 1265000
            // tax = tax > 1265000 ? 1265000 : tax
        }

        var taxPerMonth = tax / 12
        var result = {
            vatCutPercent: vatCutPercent,
            taxAllYear: Number(tax.toFixed(2)),
            taxPerMonth: Number(taxPerMonth.toFixed(2)),
        }

        return result
    } else {
        return 'no data send'
    }
}

function calOTIncome(_docStandardProfile, { salary, otHour, otType, empType }) {
    //otHour => ตัวแปรชั่วโมงเพื่อเอาไปคิดโอทีแบบชม.
    //function นี้ คิดโอทีวันละ 1 ครั้ง ถ้าเกิน 1 วัน ให้เรียกฟังก์ชั่นอีกรอบ
    var result = 0
    //ถ้ากลุ่มนี้มีเงื่อนไขการจ่ายโอทีวันทำงานปกติ
    if (_docStandardProfile.UseOTDefault == '1' && otType == 'โอทีวันทำงานปกติ') {
        if (_docStandardProfile.UseOTDefaultTypeID == '1') {
            console.log('OT เท่า');
            //คิดแบบจ่ายเป็นเท่า พนักงานเงินเดือน => สูตร. (ค่าจ้างต่อเดือน ÷ สามสิบ ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
            if (empType == '1') {
                //พนักงานรายเดือน
                result =
                    (salary / 30 / 8) *
                    Number(_docStandardProfile.UseOTDefaultTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '2') {
                //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
                result =
                    (salary / 8) *
                    Number(_docStandardProfile.UseOTDefaultTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '3') {
                result = salary *
                    Number(_docStandardProfile.UseOTDefaultTypeIDPerTimes) *
                    Number(otHour)
            }
        } else if (_docStandardProfile.UseOTDefaultTypeID == '2') {
            console.log('OT เหมา');
            //คิดแบบเหมาเป็นวัน
            result = Number(_docStandardProfile.UseOTDefaultTypeIDPerBaht)

        } else if (_docStandardProfile.UseOTDefaultTypeID == '3') {
            // console.log('OT ชั่วโมง');
            // คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท
            var arTime = ((otHour.toFixed(2)).toString()).split('.')
            var timeOT = (Number(arTime[0]) * 60) + Number(arTime[1])
            var bathTH = Number(_docStandardProfile.UseOTDefaultTypeIDPerHourBaht)/60

            result = timeOT * bathTH
                
        }
    }

    //ถ้ากลุ่มนี้มีเงื่อนไขการจ่ายโอทีวันหยุดประจำสัปดาห์
    if (_docStandardProfile.UseOTWeekend == '1' && otType == 'โอทีวันหยุดประจำสัปดาห์') {
        if (_docStandardProfile.UseOTWeekendTypeID == '1') {
            //คิดแบบจ่ายเป็นเท่า พนักงานเงินเดือน => สูตร. (ค่าจ้างต่อเดือน ÷ สามสิบ ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
            if (empType == '1') {
                //พนักงานรายเดือน
                result =
                    (salary / 30 / 8) *
                    Number(_docStandardProfile.UseOTWeekendTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '2') {
                //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
                result =
                    (salary / 8) *
                    Number(_docStandardProfile.UseOTWeekendTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '3') {
                result =
                    salary *
                    Number(_docStandardProfile.UseOTWeekendTypeIDPerTimes) *
                    Number(otHour)
            }
        } else if (_docStandardProfile.UseOTWeekendTypeID == '2') {
            //คิดแบบเหมาเป็นวัน
            result = Number(_docStandardProfile.UseOTWeekendTypeIDPerBaht)
        } else if (_docStandardProfile.UseOTWeekendTypeID == '3') {
            //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท
            result =
                Number(otHour) *
                Number(_docStandardProfile.UseOTWeekendTypeIDPerHourBaht)
        }
    }

    //ถ้ากลุ่มนี้มีเงื่อนไขการจ่ายโอทีวันหยุดพิเศษหรือนักขัตฤกษ์
    if (_docStandardProfile.UseOTHoliday == '1' && otType == 'โอทีวันหยุดพิเศษ') {
        if (_docStandardProfile.UseOTHolidayTypeID == '1') {
            //คิดแบบจ่ายเป็นเท่า พนักงานเงินเดือน => สูตร. (ค่าจ้างต่อเดือน ÷ สามสิบ ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
            if (empType == '1') {
                //พนักงานรายเดือน
                result =
                    (salary / 30 / 8) *
                    Number(_docStandardProfile.UseOTHolidayTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '2') {
                //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
                result =
                    (salary / 8) *
                    Number(_docStandardProfile.UseOTHolidayTypeIDPerTimes) *
                    Number(otHour)
            } else if (empType == '3') {
                result =
                    salary *
                    Number(_docStandardProfile.UseOTHolidayTypeIDPerTimes) *
                    Number(otHour)
            }
        } else if (_docStandardProfile.UseOTHolidayTypeID == '2') {
            //คิดแบบเหมาเป็นวัน
            result = Number(_docStandardProfile.UseOTHolidayTypeIDPerBaht)
        } else if (_docStandardProfile.UseOTHolidayTypeID == '3') {
            //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท
            result =
                Number(otHour) *
                Number(_docStandardProfile.UseOTHolidayTypeIDPerHourBaht)
        }
    }

    return result
}

function calWorkHWIncome(
    _docStandardProfile, { salary, workHour, workType, empType }
) {
    //workHour => ตัวแปรชั่วโมงเพื่อเอาไปคิดแบบชม.
    //function นี้ คิดวันละ 1 ครั้ง ถ้าเกิน 1 วัน ให้เรียกฟังก์ชั่นอีกรอบ

    var result = 0

    //ถ้ากลุ่มนี้มีเงื่อนไขการจ่ายเงิน วันหยุดพิเศษ
    if (
        _docStandardProfile.UsePayMoneyHoliday == '1' &&
        workType == 'วันหยุดพิเศษ'
    ) {
        if (_docStandardProfile.UsePayMoneyHolidayTypeID == '1') {
            //คิดแบบจ่ายเป็นเท่า พนักงานเงินเดือน => สูตร. (ค่าจ้างต่อเดือน ÷ สามสิบ ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
            if (empType == '1') {
                //พนักงานรายเดือน
                result =
                    (salary / 30 / 8) *
                    Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                    Number(workHour)
            } else if (empType == '2') {
                //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำโอที
                result =
                    (salary / 8) *
                    Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                    Number(workHour)
            } else if (empType == '3') {
                result =
                    salary *
                    Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                    Number(workHour)
            }
        } else if (_docStandardProfile.UsePayMoneyHolidayTypeID == '2') {
            //คิดแบบเหมาเป็นวัน
            result = Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerBaht)
        } else if (_docStandardProfile.UsePayMoneyHolidayTypeID == '3') {
            //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท
            result =
                Number(workHour) *
                Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerHourBaht)
        }
    }

    //ถ้ากลุ่มนี้มีเงื่อนไขการจ่ายเงินวันหยุดประจำสัปดาห์
    if (
        _docStandardProfile.UsePayMoneyWeekend == '1' &&
        workType == 'วันหยุดประจำสัปดาห์'
    ) {
        if (_docStandardProfile.UsePayMoneyWeekendTypeID == '1') {
            //คิดแบบจ่ายเป็นเท่า พนักงานเงินเดือน => สูตร. (ค่าจ้างต่อเดือน ÷ สามสิบ ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำงาน
            if (empType == '1') {
                //พนักงานรายเดือน
                result =
                    (salary / 30 / 8) *
                    Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                    Number(workHour)
            } else if (empType == '2') {
                //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน ÷ ชั่วโมงงานปกติ) × จำนวนเท่า × จำนวนชั่วโมงที่ทำงาน
                result =
                    (salary / 8) *
                    Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                    Number(workHour)
            } else if (empType == '3') {
                result =
                    salary *
                    Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                    Number(workHour)
            }
        } else if (_docStandardProfile.UsePayMoneyWeekendTypeID == '2') {
            //คิดแบบเหมาเป็นวัน
            result = Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerBaht)
        } else if (_docStandardProfile.UsePayMoneyWeekendTypeID == '3') {
            //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท
            result =
                Number(workHour) *
                Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerHourBaht)
        }
    }

    return result
}

function getCheckIn(
    userId,
    compId,
    _profildata,
    selectStartDate,
    selectEndDate
) {
    console.log('ดึงข้อมูลเช็คอิน', userId)
    console.log('AAA', compId)
    console.log('BBB', _profildata)
    console.log('CCC', selectStartDate)
    console.log('DDD', selectEndDate)
    // if(userId == 'Auz5ETJmpo1Lp1UPYwxw'){
    //     console.log('ดึงข้อมูลเช็คอิน',userId);
    // }
    return new Promise((resolve) => {
        db.collection(compId + 'CheckIn')
            .doc(userId)
            .get()
            .then((doc) => {
                var result = []
                // console.log('xxx', doc.data());
                if (doc.data() != undefined) {
                    if (doc.data().CheckIn.length > 0) {
                        
                        var dataForLoop = []

                        var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                        var endDate = moment(selectEndDate).add(1, 'day') //วันสินสุด +1 วัน เป็นตัวกรอง
                        dataForLoop = doc.data().CheckIn.filter((ele) =>
                                    moment(ele.CheckInTime.toDate()).isAfter(startDate) &&
                                    moment(ele.CheckInTime.toDate()).isBefore(endDate))

                        dataForLoop = dataForLoop.sort((a, b) => {
                            return a.CheckInTime.toDate() - b.CheckInTime.toDate()
                        })

                        // console.log('dataForLoopdataForLoop', dataForLoop)
                        var ii = 0;
                        for (let ele of dataForLoop) {
                            var testCheckIn = moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format(
                                'YYYY-MM-DD HH:mm:ss'
                            )
                            if (doc.id == '7hJMvH9g67m0X2uj6LHG') {
                                console.log('jak ==> testCheckIn', testCheckIn, ii);
                            }
                            ii++
                            //เช็คว่าถ้ามีเช็คอินซ้ำในวันให้เอาเวลาที่เข้างานแรกสุดมาแสดง
                            var finded = result.find(
                                (res) =>
                                    moment(res.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                                    moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD')
                            )

                            // console.log('findedfindedfinded', finded)

                            if (finded == undefined) {
                                //เช็คว่าใช้เงื่อนไขเข้างานสายหรือไม่

                                if (_profildata.UseTimeLateMinite != undefined) {
                                    if (_profildata.UseTimeLateMinite == '1') {
                                        //ถ้าเป็น 1 คือนับเวลามาสาย
                                        var timeLate = _profildata.TimeLate //เริ่มนับเวลามาสายที่นาทีเท่าไหร่
                                        var timeIn = _profildata.TimeIn //เวลาเข้างาน
                                        // res.CheckInTime.toDate()
                                        console.log(
                                            'time1',
                                            moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') +
                                            ' ' +
                                            timeIn
                                        )
                                        console.log(
                                            'time2',
                                            moment(ele.CheckInTime.toDate())
                                                .tz('Asia/Bangkok')
                                                .format('YYYY-MM-DD HH:mm')
                                        )

                                        var _diff = timediff(
                                            moment(ele.CheckInTime.toDate())
                                                .tz('Asia/Bangkok')
                                                .format('YYYY-MM-DD') +
                                            ' ' +
                                            timeIn,
                                            moment(ele.CheckInTime.toDate())
                                                .tz('Asia/Bangkok')
                                                .format('YYYY-MM-DD HH:mm'),
                                            'ms'
                                        )

                                        if (_diff.minutes > timeLate) {
                                            console.log('_diff', _diff)
                                            ele['LateCount'] = 1
                                            ele['LateTimeMinite'] = _diff.minutes
                                        }
                                    }
                                }
                                //ถ้าไม่มีเช็คอินซ้ำให้นำข้อมูลไปแสดงได้เลย
                            }

                            result.push(ele)
                        }

                        resolve(result)
                    } else {
                        
                        resolve(result)
                        console.log('result', result);
                    }
                }else{
                    resolve(result)
                    console.log('result', result);
                }
                
            })
    })
}

function getCheckOut(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db.collection(compId + 'CheckOut')
            .doc(userId)
            .get()
            .then((doc) => {
                var result = []
                if (doc.data().CheckOut.length > 0) {
                    var dataForLoop = []
                    var startDate = moment(selectStartDate)
                        .locale('th')
                        .subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                    var endDate = moment(selectEndDate).locale('th').add(1, 'day') //วันสินสุด +1 วัน เป็นตัวกรอง
                    dataForLoop = doc
                        .data()
                        .CheckOut.filter(
                            (ele) =>
                                moment(ele.CheckOutTime.toDate()).isAfter(startDate) &&
                                moment(ele.CheckOutTime.toDate()).isBefore(endDate)
                        )
                    dataForLoop = dataForLoop.sort((a, b) => {
                        return b.CheckOutTime.toDate() - a.CheckOutTime.toDate()
                    })

                    for (let ele of dataForLoop) {
                        //เช็คว่าถ้ามีเช็คเอ้าซ้ำในวันให้เอาเวลาที่ออกงานท้ายสุดมาแสดง
                        var finded = result.find(
                            (res) =>
                                moment(res.CheckOutTime.toDate()).format('YYYY-MM-DD') ==
                                moment(ele.CheckOutTime.toDate()).format('YYYY-MM-DD')
                        )
                        if (finded == undefined) {
                            //ถ้าไม่มีเช็คเอ้าซ้ำให้นำข้อมูลไปแสดงได้เลย
                            // result.push(ele)
                        }
                        result.push(ele)
                    }

                    resolve(result)
                } else {
                    resolve(result)
                }
            })
    })
}

function getLeave(userId, compId, selectStartDate, selectEndDate) {
    // console.log('Jay Leave ', userId, compId, selectStartDate, selectEndDate);
    return new Promise((resolve) => {
        db.collection(compId + 'TypeLeave')
            .get()
            .then((docTypes) => {
                var typeLeave = []
                for (const docType of docTypes.docs) {
                    typeLeave.push(docType.data())
                }
                // docTypes.docs.forEach((docType) => {
                //     typeLeave.push(docType.data())
                // })

                // console.log('Jay Leave ', typeLeave);
                db.collection(compId + 'Leave')
                    .where('User_ID', '==', userId)
                    .where('Status', '==', 1)
                    .get()
                    .then((querySnapshot) => {
                        var result = []
                        var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                        var endDate = moment(selectEndDate).add(1, 'day') //วันสิ้นสุด +1 วัน เป็นตัวกรอง
                        // console.log('Jay Leave ', querySnapshot.docs.length);
                        if (querySnapshot.docs.length > 0) {
                            for (const doc of querySnapshot.docs) {
                                var _doc = doc.data()
                                _doc['LeaveID'] = doc.id
                                var finded = typeLeave.find((ele) => ele.ID == _doc.TypeLeaveDocID)
                                _doc['LeaveTypeData'] = { Name: '' }
                                if (finded != undefined) {
                                    _doc['LeaveTypeData'] = finded
                                }

                                if (moment(_doc.StartDateTime.toDate()).isAfter(startDate) && moment(_doc.StartDateTime.toDate()).isBefore(endDate)) {
                                    result.push(_doc)
                                }
                            }
                            // querySnapshot.docs.forEach((doc) => {
                            // console.warn('xoxoxo', result);
                            // })
                            resolve(result)
                        } else {
                            resolve(result)
                        }
                    })
            })
    })
}

function getLate(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db.collection(compId + 'Late')
            .where('User_ID', '==', userId)
            .where('Status', '==', 1)
            .get()
            .then((querySnapshot) => {
                var result = []
                var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                var endDate = moment(selectEndDate).add(1, 'day') //วันสิ้นสุด +1 วัน เป็นตัวกรอง
                if (querySnapshot.docs.length > 0) {
                    querySnapshot.docs.forEach((doc) => {
                        var _doc = doc.data()
                        if (
                            moment(_doc.DateTimeLate.toDate()).isAfter(startDate) &&
                            moment(_doc.DateTimeLate.toDate()).isBefore(endDate)
                        ) {
                            result.push(_doc)
                        }
                    })
                    resolve(result)
                } else {
                    resolve(result)
                }
            })
    })
}

function getOverTime(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db.collection(compId + 'HistoryOT')
            .where('User_ID', '==', userId)
            .get()
            .then((querySnapshot) => {
                var result = []
                var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                var endDate = moment(selectEndDate).add(1, 'day') //วันสิ้นสุด +1 วัน เป็นตัวกรอง
                if (querySnapshot.docs.length > 0) {
                    var sumHours = 0
                    var sumMinutes = 0
                    querySnapshot.docs.forEach((doc) => {
                        var _doc = doc.data()
                        if (_doc.Status == 1) {
                            // var _startDate = _doc.StartDateTime.toDate()
                            // var _endDate = _doc.EndDateTime.toDate()

                            var newDiff = timediff(_doc.StartDateTime.toDate(), _doc.EndDateTime.toDate())
                            console.warn('newDiff --> ', newDiff.hours);
                            console.error('newDiff --> ', newDiff.minutes);
                            sumHours = newDiff.weeks * 24 * 7 + newDiff.days * 24 + newDiff.hours
                            sumMinutes = newDiff.minutes

                            if (moment(_doc.StartDateTime.toDate()).isAfter(startDate) && moment(_doc.EndDateTime.toDate()).isBefore(endDate)) {
                                var diff = moment.tz(_doc.EndDateTime.toDate(), 'Asia/Bangkok').diff(moment.tz(_doc.StartDateTime.toDate(), 'Asia/Bangkok'),'hours',true)
                                _doc['OT_Hour'] = diff
                                _doc['sumHours'] = sumHours
                                _doc['sumMinutes'] = sumMinutes
                                result.push(_doc)
                            }
                        }
                    })
                    resolve(result)
                } else {
                    resolve(result)
                }
            })
    })
}

function getEmployeeShitf(userId, compId, selectStartDate, selectEndDate) {
    // console.log('getEmployeeShitfuserId', userId);
    return new Promise((resolve) => {
        db.collection(compId + 'EmployeeShift')
            .doc(userId)
            .get()
            .then(async (querySnapshot) => {
                var result = []
                if (querySnapshot.exists) {
                    var _doc = querySnapshot.data()

                    // result = _doc.dataSave.filter((ele) => moment.tz(ele.Day, 'Asia/Bangkok').isBetween(selectStartDate, selectEndDate))
                    for (const ele of _doc.dataSave) {
                        if (
                            moment
                                .tz(ele.Day, 'Asia/Bangkok')
                                .isBetween(selectStartDate, selectEndDate) ||
                            ele.Day == selectStartDate ||
                            ele.Day == selectEndDate
                        ) {
                            var resDocSettingShift = await db
                                .collection(compId + 'SettingShifts')
                                .doc(ele.Shift_ID)
                                .get()
                            ele['ShiftDetail'] = resDocSettingShift.data()
                            result.push(ele)
                        }
                    }

                    resolve(result)
                } else {
                    resolve(result)
                }
            })
    })
}

function getJob(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db.collection(compId + 'JobAnnouncement')
            .where('Status', 'in', [2, 3])
            .get()
            .then((querySnapshot) => {
                var result = []
                if (querySnapshot.docs.length > 0) {
                    var filtered = []
                    querySnapshot.docs.forEach((ele) => {
                        var _doc = ele.data()
                        if (
                            moment
                                .tz(_doc.StartDate, 'Asia/Bangkok')
                                .isBetween(selectStartDate, selectEndDate)
                        ) {
                            var _docEmployee = _doc.Employee.filter(
                                (emp) => emp.UserID == userId && emp.StatusJob == 1
                            )
                            //ถ้าพนักงาน มีการเข้างานจากประกาศงาน ให้เอาข้อมูลงานนั้นๆ ไปคำนวนวันทำงาน
                            if (_docEmployee.length > 0) {
                                result.push(ele.data())
                            }
                        }
                    })

                    resolve(result)
                } else {
                    resolve(result)
                }
            })
    })
}

exports.apiPayrollUserNew = functions.https.onCall(async (data, context) => {
    console.log('วนเพื่อคำนวนใหม่ New');
    if (data != undefined) {
        const userId = data.userId //user id
        const compId = data.compId //company code
        const startDate = data.startDate //วันเริ่มต้นคิดเงิน
        const endDate = data.endDate //วันสิ้นสุดคิดเงิน
        const payDate = data.payDate //วันที่จ่ายเงิน
        const profileId = data.profileId // Standdard Profile กลุ่มพนักงาน
        const docUser = data.docUser
        var employeeTypeId = docUser.EmployeeTypeID // ประเภทพนักงาน 1 = รายเดือน 2 = รายวัน 3 = รายชม.
        const addMoneyExtra = data.addMoneyExtra //ถ้ามีเพิ่มเงินพิเศษ
        const addExpenseExtra = data.addExpenseExtra //ถ้ามีหักเงินพิเศษ
        const calNew = data.calNew //ถ้า เป็น 1 =สั่งคำนวนเงินเดือนใหม่

        //ถ้าเป็นceo ถือว่าเป็นรายเดือนทันที
        if (employeeTypeId == undefined || employeeTypeId == null) {
            employeeTypeId = 1;
        }

        // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
        //     console.log('datadatadata เงินเดือน', docUser.Salary);
        // }

        var salary = docUser.Salary
        var income = 0
        var expense = 0
        var netmoney = 0
        var lateLeaveMoney = 0;
        var listExtraMoney = {
            ExpenseHintTextList: [],
            ExpenseMoneyTextList: [],
            ExpenseNameTextList: [],
            IncomeHintTextList: [],
            IncomeMoneyTextList: [],
            IncomeNameList: [],
        }

        // if (userId == 'B6hPBB48gtuskYhT8mKI') {
        //     console.log('Jay Salary == ', salary);
        // }


        // console.log('docUser.SalaryDiligent', docUser.SalaryDiligent);
        // console.log('docUser.SalaryLiving', docUser.SalaryLiving);
        // console.log('docUser.SalaryPosition', docUser.SalaryPosition);
        // console.log('isNaN(Number(docUser.SalaryDiligent)))', isNaN(Number(docUser.SalaryDiligent)));
        // console.log('isNaN(Number(docUser.SalaryLiving)))', isNaN(Number(docUser.SalaryLiving)));
        // console.log('isNaN(Number(docUser.SalaryPosition)))', isNaN(Number(docUser.SalaryPosition)));
        //เบี้ยขยัน
        var SalaryDiligent = 0
        if (docUser.SalaryDiligent != undefined && isNaN(Number(docUser.SalaryDiligent)) == false) {
            SalaryDiligent = Number(docUser.SalaryDiligent);
        }
        //ค่าครองชีพ
        var SalaryLiving = 0
        if (docUser.SalaryLiving != undefined && isNaN(Number(docUser.SalaryLiving)) == false) {
            SalaryLiving = Number(docUser.SalaryLiving);
        }

        //ค่าตำแหน่ง
        var SalaryPosition = 0
        if (docUser.SalaryPosition != undefined && isNaN(Number(docUser.SalaryPosition)) == false) {
            SalaryPosition = Number(docUser.SalaryPosition);
        }

        var SalaryOT = 0; //ค่าโอที
        var SumOTHour = 0; //รวมชม.โอที

        var SalaryShift = 0; //ค่ากะ
        var SumShiftDay = 0; //รวมเข้ากะกี่วัน

        var _tmpDatePay = moment(payDate).format('YYYYMMDD')
        var _tmpDatePayMonthOnly = moment(payDate).format('YYYYMM')

        var docStandardProfile = await db
            .collection(compId + 'StandardProfile')
            .doc(profileId)
            .get()
        var _docStandardProfile = docStandardProfile.data()

        var docTaxDeduction = await db
            .collection(compId + 'TaxDeduction')
            .doc(userId + '_' + _tmpDatePay)
            .get()
        // var _docTaxDeduction = docTaxDeduction.data()
        // console.log('_docTaxDeduction', _docTaxDeduction)

        var docPayroll = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .get()

        var docPayrollMonth = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .get()

        if(docPayrollMonth.data() != undefined){
            var payrollMonth = docPayrollMonth.data()
            // console.log('payrollMonth Jay => ', payrollMonth.ExpenseHintTextList.length , payrollMonth.IncomeHintTextList.length);

            if(payrollMonth.ExpenseHintTextList.length > 0){
                for (let Ex = 0; Ex < payrollMonth.ExpenseHintTextList.length; Ex++) {
                    console.log('loop Ex = ', Ex);
                    if(Ex > 5){
                        listExtraMoney['ExpenseHintTextList'].push(payrollMonth.ExpenseHintTextList[Ex])
                        listExtraMoney['ExpenseMoneyTextList'].push(payrollMonth.ExpenseMoneyTextList[Ex])
                        listExtraMoney['ExpenseNameTextList'].push(payrollMonth.ExpenseNameTextList[Ex])
                    }
                }
            }

            // console.log('listExtraMoney Jay => ', listExtraMoney);

            if(payrollMonth.IncomeHintTextList.length > 0){
                for (let In = 0; In < payrollMonth.IncomeHintTextList.length; In++) {
                    console.log('loop In = ', In);
                    if(In > 5){
                        listExtraMoney['IncomeHintTextList'].push(payrollMonth.IncomeHintTextList[In])
                        listExtraMoney['IncomeMoneyTextList'].push(payrollMonth.IncomeMoneyTextList[In])
                        listExtraMoney['IncomeNameList'].push(payrollMonth.IncomeNameList[In])
                    }
                }
            }

            // console.log('listExtraMoney Jay => ', listExtraMoney);
        }

        var dataForSavePayRoll = {}

        var profileTimeLate = 0; //กี่นาทีถึงจะเริ่มนับสาย
        if (_docStandardProfile.UseTimeLateCutMoney == '1') {
            profileTimeLate = _docStandardProfile.TimeLate
        }


        if (docPayroll.data() != undefined) {

            console.log('ถ้ามีข้อมูลเงินเดือนที่ทำไว้ New');
            //ถ้ามีข้อมูลเงินเดือนที่ทำไว้
            // console.log('xxx', userId)

            dataForSavePayRoll = docPayroll.data()

            //ข้อมูลวันหยุดประจำปี
            var holidayData = {}
            if (
                moment(startDate).format('YYYY') ==
                moment(endDate).format('YYYY')
            ) {
                //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
                var _tmpHoliday = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData = _tmpHoliday.data()
            } else {
                //กรณีดึงข้อมูลข้ามปี
                var _tmpHolidayStart = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                var _tmpHolidayEnd = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData['Holiday'] = _tmpHolidayStart
                    .data()
                    .Holiday.concat(_tmpHolidayEnd.Holiday)
                holidayData['HolidayName'] = _tmpHolidayStart
                    .data()
                    .HolidayName.concat(_tmpHolidayEnd.HolidayName)
            }

            // console.log('holidayData->', holidayData);

            //นับวันที่ทำงาน ขาด ลา มาสาย

            const currentMomentPeruser = moment(startDate).locale('th')
            const endMomentPeruser = moment(endDate).locale('th').add(1, 'day')
            const checkIn = await getCheckIn(userId,
                compId,
                _docStandardProfile,
                startDate,
                endDate)

            // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
            // console.log('employeeShitfDoc qqq33');
            // }


            const checkOut = await getCheckOut(userId,
                compId,
                startDate,
                endDate)
            const leaveDoc = await getLeave(userId,
                compId,
                startDate,
                endDate)
            const lateDoc = await getLate(userId,
                compId,
                startDate,
                endDate)

            console.log('Jay เวลาขอสาย', lateDoc);

            //ดึงข้อมูล OT 
            const overTimeDoc = await getOverTime(userId,
                compId,
                startDate,
                endDate)
            // console.log('overTimeDoc', overTimeDoc);

            //ดึงข้อมูลกะ
            // console.log('userId', userId);
            const employeeShitfDoc = await getEmployeeShitf(userId,
                compId,
                startDate,
                endDate)
            // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
            //     console.log('employeeShitfDoc qqq', employeeShitfDoc);
            // }

            //ดึงข้อมูล ประกาศงาน 
            const jobDoc = await getJob(userId,
                compId,
                startDate,
                endDate)
            // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
            //     console.log('jobDoc', jobDoc);
            // }

            var CountDateCheckIn = 0; //นับวันทำงาน
            var CountLate = 0; //นับครั้งมาสาย
            var SumLateTime = 0; //นับนาทีมาสาย
            var CountDateWeekend = 0; //นับวันหยุดประจำสัปดาห์
            var CountLeave = 0; //นับวันลา
            var CountNotWork = 0; //นับวันขาดงาน
            var CountHoliday = 0; //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var CountWeekendWork = 0 //นับวันทำงานที่เป็นวันหยุดประจำสัปดาห์
            var CountHolidayWork = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var SumMoneyWeekend = 0 //รวมเงินที่ทำงานวันหยุดประจำสัปดาห์
            var SumMoneyHoliday = 0 //รวมเงินที่ทำงานวันหยุดพิเศษ
            var SumDayNoMoney = 0 //รวมเงินลาประเภทที่ไม่ได้รับเงิน
            var arrLeave = [] //เก็บประเภทการลา

            //วนนับวันทำงาน
            while (currentMomentPeruser.isBefore(endMomentPeruser, 'day')) {
                var CountDayla = false  ////ตัวแปรเช็ควันลา

                if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                    console.log('Log ก่อนตัดวันใหม่ ', SumLateTime);
                }

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
                var timePleaseLate = 0
                var findLate = lateDoc.find((ele) => moment.tz(ele.DateTimeLate.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'))

                if(findLate != undefined){
                    var timeLateUser = moment.tz(findLate.DateTimeLate.toDate(), 'Asia/Bangkok').format('HH:mm')
                    var timeCheckInProfile = moment('2022-01-01 ' + _docStandardProfile.TimeIn).toDate()
                    var timeCheckInLate = moment('2022-01-01 ' + timeLateUser).toDate()

                    var diffLate = timediff(timeCheckInProfile, timeCheckInLate)
                    // console.warn('diffLate -> ', diffLate);
                    timePleaseLate = (diffLate.hours * 60) + diffLate.minutes
                }

                

                timePleaseLate = Number(timePleaseLate) + Number(profileTimeLate)

                // console.log('มาสายได้ ', timePleaseLate + ' นาที');
                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//


                var _tmpCheckLate = false
                var checkInShow = '-'
                //หาเช็คอินแรกสุด
                var finded = checkIn.find(
                    (ele) =>
                        moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                // if (data.userId == 'Auz5ETJmpo1Lp1UPYwxw') {
                //     console.log('findedfindedfindedfinded ->', finded);
                // }

                //หาเข็คเอ้าสุดท้าย เรียงเอ้าสุดท้ายจาก getCheckOut แล้ว
                var findedCheckOut = checkOut.find(
                    (ele) =>
                        moment(ele.CheckOutTime.toDate()).tz('Asia/Bangkok').format(
                            'YYYY-MM-DD'
                        ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                )


                //ถ้ามีการเช็คอิน
                if (finded != undefined) {
                    //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                    var jobHave = false; //พนักงานมีเข้างานในการประกาศงานหรือไม่
                    var jobLate = 0; //พนักงานเข้าสาย
                    var jobLateTime = 0; //พนักงานเข้าสายนาที
                    if (jobDoc.length > 0) {
                        //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                        var findedJob = jobDoc.find(ele => ele.StartDate == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->findedJob', findedJob);
                        if (findedJob != undefined) {
                            jobHave = true;
                            var latediff = moment.tz(finded.CheckInTime.toDate(), 'Asia/Bangkok').diff(moment.tz(findedJob.StartDate + ' ' + findedJob.StartTime, 'Asia/Bangkok'), 'minutes');
                            // finded['LateTimeMinite'] = latediff
                            if (latediff > timePleaseLate) {
                                jobLate = 1;
                                jobLateTime = latediff
                            }
                        }
                    }

                    //ตรวจสอบว่าวันนี้มี กะหรือไม่ 
                    var shiftHave = false; //พนักงานมีเข้างานในกะหรือไม่
                    var shiftLate = 0; //พนักงานเข้ากะแล้วสายครั้ง
                    var shiftLateTime = 0; //พนักงานเข้ากะสายนาที


                    if (employeeShitfDoc.length > 0) {
                        // console.log('currentMomentPeruser2222', currentMomentPeruser);
                        var findedShitf = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).tz('Asia/Bangkok').format('YYYY-MM-DD'));
                        if (findedShitf != undefined) {
                            shiftHave = true;
                            // if(data.userId == 'Auz5ETJmpo1Lp1UPYwxw'){
                            //     console.log('-->shiftHave latediff Auz5ETJmpo1Lp1UPYwxw1', finded.CheckInTime.toDate(), findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok');
                            // }
                            var beforConvert = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD');
                            var afterConvert = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').format('HH:mm');
                            // var latediff = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').diff(moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'), 'minutes');
                            var latediff = moment.tz(beforConvert + ' ' + afterConvert, 'Asia/Bangkok').diff(moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'), 'minutes');
                            // if(data.userId == 'Auz5ETJmpo1Lp1UPYwxw'){
                            //     console.log('-->shiftHave latediff Auz5ETJmpo1Lp1UPYwxw2', moment.tz(beforConvert+' '+afterConvert,'Asia/Bangkok'), moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'));
                            // }
                            finded['LateTimeMinite'] = latediff
                            if (latediff > timePleaseLate) {
                                shiftLate = 1;
                                shiftLateTime = latediff
                            }
                        }

                    }

                    if (data.userId == 'lOE0jMgJYyRvoE2r2f0p') {
                        console.log('CountNotWork นับวันขาด', CountNotWork);
                    }


                    //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                    if (jobHave == true) {
                        //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (jobLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(jobLateTime)
                        }

                        if (shiftHave == true) { //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                            SumShiftDay += 1;
                            SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                        }

                    } else if (shiftHave == true) {
                        //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                        SumShiftDay += 1;
                        SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                        //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (shiftLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(shiftLateTime)
                        }
                    } else { //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                        //กรณีมีสาย
                        if (finded.LateCount != undefined) {
                            if(Number(finded.LateTimeMinite) > timePleaseLate){
                                lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(finded.LateTimeMinite)
                            }
                        }
                    }



                    console.log('==>SumLateTime', SumLateTime, jobHave);
                    //นับวันทำงาน
                    CountDateCheckIn++
                    checkInShow = moment(finded.CheckInTime.toDate()).format('เข้า HH:mm ')

                }

                if (findedCheckOut != undefined) {
                    //กรณีมีเช็คอิน
                    checkInShow =
                        checkInShow +
                        moment(findedCheckOut.CheckOutTime.toDate()).format(
                            ' - ออก HH:mm'
                        )
                }

                //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                var _tmpThisWeekend = false
                if (
                    _docStandardProfile.Weeked.Mon == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Mon'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Tue == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Tue'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Wed == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Wed'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Thu == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Thu'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Fri == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Fri'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sat == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Sat'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sun == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Sun'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }

                //เช็คว่าเป็นวันหยุดพิเศษไหม
                var _findedHolidaData = holidayData.Holiday.find(
                    (ele) =>
                        ele == moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                )

                //คำนวนโอที
                if (overTimeDoc.length > 0) {
                    var findedOverTime = overTimeDoc.find(ele => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                    var filterDataOT = overTimeDoc.filter((ele) => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                    )

                    if (filterDataOT.length > 0) {

                        var sumHoursOT = 0
                        var sumMinutesOT = 0
                        for (let indexOT = 0; indexOT < filterDataOT.length; indexOT++) {
                            var itemOT = filterDataOT[indexOT];
                            sumHoursOT += itemOT.sumHours
                            sumMinutesOT += itemOT.sumMinutes
                        }

                        var sumAllOT = Number(sumHoursOT + '.' + sumMinutesOT)

                        var _otType = 'โอทีวันทำงานปกติ';
                        if (_findedHolidaData != undefined) {
                            _otType = 'โอทีวันหยุดพิเศษ';
                        } else if (_tmpThisWeekend == true) {
                            _otType = "โอทีวันหยุดประจำสัปดาห์";
                        }

                        if(shiftHave == true){
                            _otType = 'โอทีวันทำงานปกติ';
                        }
                        var _obj = {
                            salary: salary,
                            otHour: sumAllOT,
                            otType: _otType,
                            empType: employeeTypeId, //พนักงานรายวัน
                        }
                        console.log('==>__obj', _obj);
                        var _money = await calOTIncome(_docStandardProfile, _obj)

                        if(userId == 'e9rpmloDid86WNgN0SgT'){
                            console.log('Jay OT userId -> ', _money);
                        }

                        SumOTHour += Number(sumAllOT)
                        SalaryOT += Number(_money)
                    }

                }

                //เช็คว่าลาหรือไม่
                var findedLeave = leaveDoc.find(
                    (ele) =>
                        moment(currentMomentPeruser).isBetween(moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD'), moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                )

                if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                    console.log('มีการลาในวันนี้', findedLeave);
                }

                // console.log('findedLeave',findedLeave);
                if (findedLeave != undefined) {
                    if (findedLeave.LeaveTypeData.Wages == 'ไม่ได้รับค่าจ้าง') {
                        // console.log('EEEEE', findedLeave);
                        // console.log('RRRRR', arrLeave);
                        var findArrLeave = arrLeave.findIndex((ele) => ele.LeaveID == findedLeave.LeaveID)
                        // console.log('findArrLeave', findArrLeave);
                        if (findArrLeave == -1) {
                            var cutLeaveDay = 0
                            var cutLeaveHours = 0
                            var cutLeaveMinutes = 0
                            // console.log('findedLeave.Cut_Day', findedLeave.Cut_Day);
                            if (findedLeave.Cut_Day > 0) {
                                cutLeaveDay = (salary / 30) * findedLeave.Cut_Day
                                // console.log('วัน', cutLeaveDay);
                            }

                            if (findedLeave.Cut_Hours > 0) {
                            var LeaveHours = (salary / 30)
                            cutLeaveHours = LeaveHours / 9 * findedLeave.Cut_Hours
                            // console.log('ชั่วโมง', cutLeaveHours);
                            }
                            if (findedLeave.Cut_Minutes > 0) {
                                var LeaveMinutes = (salary / 30)
                                var _LeaveMinutes = LeaveMinutes / 9
                                cutLeaveMinutes = _LeaveMinutes / 2
                                // console.log('นาที', cutLeaveMinutes);
                            }

                            arrLeave.push(findedLeave)

                            var sumUnpaid = cutLeaveDay + cutLeaveHours + cutLeaveMinutes
                            // console.log('วันลาที่ไม่ได้เงิน', sumUnpaid);
                            
                            SumDayNoMoney += sumUnpaid
                            console.log('SumDayNoMoney', SumDayNoMoney);
                        }

                    }
                    CountLeave++

                    //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                    if (finded != undefined) {
                        CountDateCheckIn--
                        var _diffLeave = timediff(findedLeave.StartDateTime.toDate(),findedLeave.EndDateTime.toDate(),'Hm')
                        var _tmpLeaveHour = ''
                        if (_diffLeave.hours < 9) {
                            _tmpLeaveHour = '' + _diffLeave.hours + '.' + _diffLeave.minutes + ' ชม.' + '\n'
                        }

                        if (_tmpCheckLate == true) {
                            //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                            if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                                console.log('ก่อนตัด', SumLateTime, CountLate, finded.LateTimeMinite);
                            }

                            CountLate--
                            SumLateTime -= Number(finded.LateTimeMinite)

                            if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                                console.log('หลังตัด', SumLateTime, CountLate);
                            }


                        }
                    }

                    if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '1') {
                        // var getLeave = 
                        // console.log('ค่าแรงในวันลา');
                        CountDateCheckIn++
                    } else if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '0' || _docStandardProfile.UseLeaveMoney == undefined) {
                        console.log('ไม่ได้ค่าแรงในวันลา');
                    }
                } else {
                    //ถ้าไม่ใช่ลา
                    if (_tmpThisWeekend == false && checkInShow == '-') {

                        if (_findedHolidaData != undefined) {
                            //ถ้าเป็นวันหยุดพิเศษ ไม่นับว่าขาดงาน
                            if (checkInShow != '-') { //ถ้ามีมาทำงานวันหยุดพิเศษให้นับวันจำนวนวันหยุดพิเศษ
                                CountHoliday++
                            }
                        } else {
                            //ถ้าเป็นวันทำงานปกติ ให้นับว่าขาด
                            if(checkInShow == '-'){
                                CountDayla = true
                                CountNotWork++
                                console.warn('CountNotWork 111', CountNotWork);
                            }
                        }

                    }
                }

                if (finded == undefined && _findedHolidaData == undefined) {
                    //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่ 
                    var findedShitf2 = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD'));

                    if (findedShitf2 != undefined && findedLeave == undefined) { //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                        if(CountDayla != true){
                            CountNotWork++
                            console.log('แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา', CountNotWork);
                        }
                    }
                }


                //ถ้ามีเช็คอินในวันหยุด หรือวันหยุดพิเศษ ให้นับวันทำงานด้วย
                if (finded != undefined) {
                    if (_findedHolidaData != undefined) {
                        //ถ้าวันนี้มาทำงานในวันหยุดพิเศษ จะนับวันทำงานด้วยเพื่อเอาไปคิดเงิน
                        CountHolidayWork++;
                    } else if (_tmpThisWeekend) {
                        var _findedHaveShitf = employeeShitfDoc.find((ele) =>  ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD'))
                        if (_findedHaveShitf == undefined) {
                            //ต้องไม่เป็นกะ ถึงจะถือว่าเป็นการทำงานวันหยุดประจำสัปดาห์
                            //วันนี้เป็นวันหยุดประจำสัปดาห์
                            CountWeekendWork++;
                        }

                    }
                } 
                console.log('วันนี้', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                console.log('ขาดงาน', CountNotWork);
                currentMomentPeruser.add(1, 'days')
            }
           
            //คำนวนเงินเดือน
            if (employeeTypeId == 2) {
                //พนักงานรายวัน
                salary = salary * CountDateCheckIn
            } else {
                //พนักงานรายเดือน
                salary = salary
            }


            dataForSavePayRoll.IncomeHintTextList[0] = 'เงินเดือน ' + numeral(Number(salary)).format('0,0.00') + ' บาท';
            dataForSavePayRoll.IncomeMoneyTextList[0] = '' + numeral(Number(salary)).format('0.00');

            // if (SalaryOT > 0 && SumOTHour > 0) {
            dataForSavePayRoll.IncomeHintTextList[2] = 'โอที ' + numeral(Number(SalaryOT)).format('0,0.00') + ' บาท';
            dataForSavePayRoll.IncomeMoneyTextList[2] = '' + numeral(Number(SalaryOT)).format('0.00');
            // }

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดประจำสัปดาห์หรือไม่

            // if(userId == 'Tm9grWttmpNt1BaWVsyL'){
                // console.log('Jay Tm9grWttmpNt1BaWVsyL -> ', _docStandardProfile.UsePayMoneyWeekend, CountWeekendWork);
            // }
            if (_docStandardProfile.UsePayMoneyWeekend == '1') {
                var _typePayWeekend = _docStandardProfile.UsePayMoneyWeekendTypeID;
                if (_typePayWeekend == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyWeekend =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyWeekend =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyWeekend =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    }
                } else if (_typePayWeekend == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyWeekend = Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayWeekend == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyWeekend =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerHourBaht) *
                        Number(CountWeekendWork)
                }
            }

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดพิเศษหรือไม่
            if (_docStandardProfile.UsePayMoneyHoliday == '1') {
                var _typePayHoliday = _docStandardProfile.UsePayMoneyHolidayTypeID;
                if (_typePayHoliday == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyHoliday =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyHoliday =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyHoliday =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    }
                } else if (_typePayHoliday == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyHoliday = Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayHoliday == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyHoliday =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerHourBaht) *
                        Number(CountHolidayWork)
                }
            }


            //คิดเงินประกันสังคม ถ้าไม่ติ๊กใช้งานคือไม่คิดเงินประกันสังคม
            var resM33 = 0
            if (_docStandardProfile.UseCutM33 != undefined) {
                if (_docStandardProfile.UseCutM33 == 1) {


                    var dataCalM33 = {
                        salary: salary,
                        percent: Number(_docStandardProfile.M33Rate),
                    }



                    resM33 = calM33(dataCalM33)
                    console.log('หลังคำนวณ M33 เสร็จ => ', resM33);

                    dataForSavePayRoll.ExpenseHintTextList[2] = 'ประกันสังคม ' + numeral(Number(resM33)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.ExpenseMoneyTextList[2] = '' + numeral(Number(resM33)).format('0.00');


                }
            }

            

            var resAbsent = 0

            if (docUser.EmployeeTypeID == 1 || docUser.EmployeeTypeName == 'พนักงานประจำ') {
                console.log('GGGGGG', CountNotWork, compId, userId, profileId, salary, SumLateTime);
                resAbsent = await calAbsent(CountNotWork, compId, userId, profileId, salary, SumLateTime);
                console.log('XXXXXXX', resAbsent);
            }

            var tax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }

            // console.log('docUser.TawitUse', docUser.TawitUse);

            //---------------------คำนวณภาษีแบบเก่า-------------------//

            // if (docUser.TawitUse == 1) {
            //     //ถ้าคิดภาษีเงินได้บุคคลธรรมดา
            //     tax = await calTax({
            //         salary: salary,
            //         moneyPay: 100000,
            //         deduc: 60000,
            //         m33: resM33 * 12,
            //     })

                dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(tax.taxPerMonth)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(tax.taxPerMonth)).format('0.00');
            // }

            //---------------------คำนวณภาษีแบบเก่า-------------------//

            // if (userId == 'N8UtHtsEYi5OLq48RynC') {
            //     console.log('datadatadata3', salary, dataForSavePayRoll.IncomeHintTextList[0]);
            //     console.log('taxtaxtaxtax -> ', tax);
            // }

            if (addMoneyExtra != undefined) {
                //ถ้ามีสั่งเพิ่มเงินพิเศษ
                dataForSavePayRoll.IncomeHintTextList.push(
                    addMoneyExtra.Name +
                    ' ' +
                    numeral(Number(addMoneyExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.IncomeMoneyTextList.push(
                    numeral(Number(addMoneyExtra.Money)).format('0,0.00')
                )
                dataForSavePayRoll.IncomeNameList.push(addMoneyExtra.Name)
            }

            if (addExpenseExtra != undefined) {
                //ถ้ามีสั่งหักเงินพิเศษ
                dataForSavePayRoll.ExpenseHintTextList.push(
                    addExpenseExtra.Name +
                    ' ' +
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.ExpenseMoneyTextList.push(
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00')
                )
                dataForSavePayRoll.ExpenseNameTextList.push(addExpenseExtra.Name)
            }
            //เช็กเพื่อเติมเบี้ยขยันก่อน
            //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
            console.log('==>SalaryDiligent', SalaryDiligent);
            dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
            dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
            console.log('==>SalaryLiving', SalaryLiving);
            //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
            if (SalaryLiving > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                console.log('==>finded', finded);
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                } else { //ถ้ามี
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryLiving)).format('0.00');
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                }
            }

            //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
            console.log('==>SalaryPosition', SalaryPosition);
            if (SalaryPosition > 0) {
                //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                } else { //ถ้ามี
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryPosition)).format('0.00');
                }
            }

            //ถ้ามีรายได้ค่ากะ ให้เติมข้อมูลใน array
            if (SalaryShift > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่ากะ');
                console.log('==>finded', finded);
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryShift)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่ากะ');
                } else { //ถ้ามี
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryShift)).format('0.00');
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                }
            }

            //------------------วันลาที่ไม่ได้เงิน--------------------//
            // console.log('ตัดค่าวันอื่นๆ', resAbsent);
            console.log('รวม', SumDayNoMoney.toLocaleString('th-TH', {maximumFractionDigits: 2, minimumFractionDigits: 2,}));
            if (SumDayNoMoney > 0) {
                resAbsent = Number(SumDayNoMoney) + Number(resAbsent)
                console.log('วันลาที่ไม่ได้เงิน', resAbsent);
            }
            
            //------------------วันลาที่ไม่ได้เงิน--------------------//

            dataForSavePayRoll.ExpenseHintTextList[3] = 'สายขาดลา ' + numeral(Number(resAbsent)).format('0,0.00') + ' บาท';
            dataForSavePayRoll.ExpenseMoneyTextList[3] = '' + numeral(Number(resAbsent)).format('0.00');

            // หักเงินมาสาย
            if (CountLate > 0 && SumLateTime > 0) {
                //ถ้ากลุ่มนี้มีตั้งเงื่อนไขสายแล้วหักเงิน

                if (_docStandardProfile.UseTimeLateCutMoney == '1') {
                    if (SumLateTime > 0) {

                        var lateMinite = SumLateTime;
                        var late = 1;
                        //เช็คว่าใช้ เงื่อนไขหักเงินมาสายจากเบี้ยขยัน ค่าครองชีพ ค่าตำแหน่ง หรือไม่
                        if (_docStandardProfile.UseTimeLateCutMoneyExtra == '1') {
                            if (_docStandardProfile.chipExtraMoney != undefined) {

                                var moneyForCutLate = 0; //จำนวนเงินสำหรับตัด
                                if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                    //หักเป็นบาท ต่อ ชม.
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)

                                } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                    //หักสูตรคิดเงินเดือน
                                    var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_moneyPerDay)

                                }
                                //เอามาเช็คว่าใน array มีการเพิ่มค่าเบี้ยเลี้ยง ค่าครองชีพ ค่าตำแหน่ง เข้าไปใน array หรือยัง ถ้ายัง ให้เอาให้เพิ่มต่อกรณีที่มีการกำหนดจำนวนเงินมา
                                var checkHaveSalaryDiligent = false;
                                var checkHaveSalaryLiving = false;
                                var checkHaveSalaryPosition = false;
                                if (moneyForCutLate > 0) {

                                    //ให้ทำการ วน ตัดจากลำดับที่เลือกไว้
                                    console.log('chipExtra.length', _docStandardProfile.chipExtraMoney.length);
                                    for (var ic = 0; ic < _docStandardProfile.chipExtraMoney.length; ic++) {
                                        var chipExtra = _docStandardProfile.chipExtraMoney[ic];
                                        if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                                            console.log('dataForSavePayRoll.IncomeMoneyTextListchipExtrachipExtra', chipExtra);
                                        }

                                        if (chipExtra == 'เบี้ยขยัน' && SalaryDiligent > 0) {
                                            // console.log('chipExtra', chipExtra);
                                            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                                                console.log('dataForSavePayRoll.IncomeMoneyTextListchipSalaryDiligent', SalaryDiligent);
                                            }
                                            //เบี้ยขยันลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryDiligent > moneyForCutLate) {
                                                checkHaveSalaryDiligent = true;
                                                //ถ้าเบี้ยขยัน > เงินที่ตั้งตัด
                                                result = SalaryDiligent - moneyForCutLate


                                                dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(result)).format('0.00');

                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryDiligent
                                                checkHaveSalaryDiligent = true;
                                                dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + '0.00' + ' บาท';
                                                dataForSavePayRoll.IncomeMoneyTextList[1] = '' + '0.00';

                                                if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                                                    console.log('dataForSavePayRoll.IncomeMoneyTextListchipSalaryIncomeMoneyTextList', dataForSavePayRoll.IncomeMoneyTextList[1]);
                                                }
                                            }


                                        } else if (chipExtra == 'ค่าครองชีพ' && SalaryLiving > 0) {
                                            console.log('chipExtra', chipExtra);
                                            //ค่าครองชีพลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryLiving > moneyForCutLate) {
                                                checkHaveSalaryLiving = true;
                                                //ถ้าค่าครองชีพ > เงินที่ตั้งตัด
                                                result = SalaryLiving - moneyForCutLate
                                                //เช็คก่อนว่ามีค่าครองชีพใส่มามั้ย
                                                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                                                if (finded == -1) { //ถ้าไม่มี
                                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                                } else { //ถ้ามี
                                                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(result)).format('0.00');

                                                }

                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                checkHaveSalaryLiving = true;
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryLiving
                                                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                                                if (finded == -1) { //ถ้าไม่มี
                                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                                } else { //ถ้ามี
                                                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(result)).format('0.00');

                                                }

                                            }

                                        } else if (chipExtra == 'ค่าตำแหน่ง' && SalaryPosition > 0) {
                                            console.log('chipExtra', chipExtra);
                                            //ค่าตำแหน่งลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryPosition > moneyForCutLate) {
                                                checkHaveSalaryPosition = true;
                                                //ถ้าค่าตำแหน่ง > เงินที่ตั้งตัด
                                                result = SalaryPosition - moneyForCutLate
                                                //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                                                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                                                if (finded == -1) { //ถ้าไม่มี
                                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                                } else { //ถ้ามี
                                                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(result)).format('0.00');
                                                }

                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                checkHaveSalaryPosition = true;
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryPosition
                                                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                                                if (finded == -1) { //ถ้าไม่มี
                                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                                } else { //ถ้ามี
                                                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(result)).format('0.00');
                                                }



                                            }


                                        } else if (chipExtra == 'เงินเดือน') {
                                            console.log('chipExtra', chipExtra);
                                            //เบี้ยขยันลบเงินที่มาสาย 
                                            var result = 0;
                                            result = salary - moneyForCutLate
                                            console.log('result', numeral(Number(result)).format('0,0.00'));

                                            dataForSavePayRoll.IncomeHintTextList[0] = 'เงินเดือน ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                            dataForSavePayRoll.IncomeMoneyTextList[0] = numeral(Number(result)).format('0.00').toString();
                                            console.log('dataForSavePayRoll.IncomeMoneyTextList[0]', dataForSavePayRoll.IncomeMoneyTextList[0]);

                                            break; //ตัดปกติจบ ตัดรอบเดียว

                                        }
                                    }
                                }

                                //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                                if (checkHaveSalaryDiligent == false && SalaryDiligent > 0) {
                                    dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
                                    dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
                                }

                                //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                                if (checkHaveSalaryLiving == false && SalaryLiving > 0) {
                                    var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                                    if (finded == -1) { //ถ้าไม่มี
                                        dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                                        dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                                        dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                    } else { //ถ้ามี
                                        dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท';
                                        dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryLiving)).format('0.00');
                                    }
                                }

                                //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                                if (checkHaveSalaryPosition == false && SalaryPosition > 0) {
                                    //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                                    var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                                    if (finded == -1) { //ถ้าไม่มี
                                        dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                                        dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                                        dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                    } else { //ถ้ามี
                                        dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท';
                                        dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryPosition)).format('0.00');
                                    }
                                }



                            }
                        } else { //ถ้าไม่ได้ตั้งหักตามลำดับ

                            // console.log('ไม่ได้ตักหักลำดับ');

                            if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                //หักเป็นบาท ต่อ ชม.
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                dataForSavePayRoll.ExpenseHintTextList[3] = 'สายขาดลา ' + numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.ExpenseMoneyTextList[3] = '' + numeral(Number(lateLeaveMoney + resAbsent)).format('0.00');
                            } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                //หักสูตรคิดเงินเดือน
                                var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_moneyPerDay)
                                dataForSavePayRoll.ExpenseHintTextList[3] = 'สายขาดลา ' + numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.ExpenseMoneyTextList[3] = '' + numeral(Number(lateLeaveMoney + resAbsent)).format('0.00');
                            }
                        }


                    }
                } else {

                    //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                    if (SalaryDiligent > 0) {
                        dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
                    }

                    //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                    if (SalaryLiving > 0) {
                        var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                        if (finded == -1) { //ถ้าไม่มี
                            dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                            dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                            dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                        } else { //ถ้ามี
                            dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท';
                            dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryLiving)).format('0.00');
                        }
                    }

                    //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                    if (SalaryPosition > 0) {
                        //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                        var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                        if (finded == -1) { //ถ้าไม่มี
                            dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                            dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                            dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                        } else { //ถ้ามี
                            dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท';
                            dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryPosition)).format('0.00');
                        }
                    }
                }
            }

            // if (userId == 'brZVFEXwSOmgAJMe9Hos') {
            //     console.log('expense ทำไว้แล้ว -> ', dataForSavePayRoll.ExpenseMoneyTextList);
            //     console.log('CountNotWork ทำไว้แล้ว -> ', CountNotWork);
            // }

            if (SumMoneyWeekend > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุด ' +
                        numeral(Number(SumMoneyWeekend)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyWeekend)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุด')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            }

            if (SumMoneyHoliday > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุดพิเศษ ' +
                        numeral(Number(SumMoneyHoliday)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyHoliday)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุดพิเศษ')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            }


            //------------ดักการใส่ลูกน้ำของลูกค้า------------//
            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                // console.log('Jay -> ', money);
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }
            //------------ดักการใส่ลูกน้ำของลูกค้า------------//

            //---------------------คำนวณภาษีแบบใหม่--------------------//
            var newTax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }

            if(docUser.TawitUse == 1){
                newTax = await calTax({
                    compId: compId,
                    salary: income,
                    moneyPay: 100000,
                    deduc: 60000,
                    m33: resM33 * 12,
                })
                // console.log('newTax -> ', newTax);
                dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(newTax.taxPerMonth)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(newTax.taxPerMonth)).format('0.00');

                if(Number(newTax.taxPerMonth) > 0){
                    expense += Number(newTax.taxPerMonth)
                }
            }
            //---------------------คำนวณภาษีแบบใหม่--------------------//

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )

            console.log('รายจ่าย -> ', expense);

            var RetainedIncome = 0
            var accumulatedTax = 0
            var cumulativeWHT = 0
            var socialSecurity = 0
            //คิวรี่ PayrollTransferSuccess เพื่อหารายได้สะสมของพนักงานแต่ละคน
            await db.collection(compId + 'PayrollTransferSuccess')
                .orderBy('Timestamp', "desc")
                .limit(1)
                .get()
                .then(async(querySnapshot) => {
                    console.log('xoxoxoxo if', querySnapshot.docs.length);
                    if (querySnapshot.docs.length > 0) {

                            var itemPayrollTransfer = querySnapshot.docs[0].data()
                            
                            var docTransfer = itemPayrollTransfer.Transfer.filter((ele) => ele.UserID == userId)
                            console.log('docTransfer-->>if', docTransfer);
                            if (docTransfer.length > 0) {
                                docTransfer.sort((a, b) => a.PayDate.localeCompare(b.PayDate))
                                //   console.log('>>>>>>', docTransfer);
                                var itemTransfer = docTransfer[docTransfer.length-1]
                                // console.log('>>>>>>>>>>>', itemTransfer);
                                /// split EndDate
                                var splitTimeStamp = itemTransfer.EndDate.split('-')
                                var arMonth = splitTimeStamp[1]
                                // var arYear = splitTimeStamp[0]
                                // var arDay = splitTimeStamp[2]

                                ///split PayDate
                                var split_payDate = itemTransfer.PayDate.split('-')
                                var arYearPayDate = split_payDate[0]
                                var arMonthPayDate = split_payDate[1]
                                var arDayPayDate = split_payDate[2]

                                var convert_payDate = moment(payDate).toDate()
                                var convertPayDate = moment(itemTransfer.PayDate).toDate()
                                // console.log('%%%%%%%%%', convert_payDate, convertPayDate);
                                // console.log('@@@@@@@@@', payDate, itemTransfer.PayDate);

                                if (payDate != itemTransfer.PayDate && convert_payDate > convertPayDate) {

                                    var dataPayDate = itemTransfer.UserID + '_' + arYearPayDate + arMonthPayDate + arDayPayDate
                                    // console.log('xoxoxoxo', dataPayDate);
                                    await db.collection(compId + 'Payroll')
                                    .doc(dataPayDate)
                                    .get()
                                    .then(async(queryPayroll) => {
                                        if (queryPayroll.data() != undefined ) {
                                            var item_Payroll = queryPayroll.data()
                                            var oSalary = item_Payroll.OtherMoneyTextList[0]
                                            // console.warn('AAA', oSalary);
                                            var oTax = item_Payroll.OtherMoneyTextList[1]
                                            // console.warn('BBB', oTax);
                                            var oWHT = item_Payroll.OtherMoneyTextList[2]
                                            // console.warn('CCC', oWHT);
                                            var oSocialMoney = item_Payroll.OtherMoneyTextList[3]
                                            // console.warn('DDD', oSocialMoney);
                                            // console.log('income', income);
                                            RetainedIncome = Number(oSalary) + income
                                            // console.log('รายได้สะสม', RetainedIncome);
                                            accumulatedTax = Number(oTax) + Number(dataForSavePayRoll.ExpenseMoneyTextList[0])
                                            // console.log('ภาษีสะสม', accumulatedTax);
                                            cumulativeWHT = Number(oWHT) + Number(dataForSavePayRoll.ExpenseMoneyTextList[1])
                                            // console.log('WHT สะสม', cumulativeWHT);
                                            socialSecurity = Number(oSocialMoney) + Number(dataForSavePayRoll.ExpenseMoneyTextList[2])

                                            // console.log('ประกันสังคมสะสม', socialSecurity);
                                            
                                            // console.log('======>', dataForSavePayRoll);
                                            var splitEndDate = endDate.split('-')
                                            var startMonth = splitEndDate[1]
                                            // console.log('&&&&&&', startMonth);

                                            if (startMonth == '01' && arMonth != '01') {
                                                // console.log('#######');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                                            }else{
                                                // console.log('*******');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(RetainedIncome)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(RetainedIncome)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(accumulatedTax)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(accumulatedTax)).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(cumulativeWHT)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(cumulativeWHT)).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(socialSecurity)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(socialSecurity)).format('0.00');
                                            }
                                        }
                                    })
                                }

                                
                            }else{
                                // console.log('1-------------------1--if');
                                // รายได้สะสม
                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                // ภาษีสะสม
                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                // WHT สะสม
                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                // ประกันสังคมสะสม
                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                            }  
                    }else{
                        // console.log('2------------------2---if');
                        // รายได้สะสม
                        dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                        // ภาษีสะสม
                        dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                        // WHT สะสม
                        dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                        // ประกันสังคมสะสม
                        dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                    }
                })

            netmoney = Number(Number(income - expense).toFixed(2))

            console.log('รายจ่าย -> ', netmoney);

        } else {
            console.log('else --->');
            //ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้
            // console.log('ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้');
            //ข้อมูลวันหยุดประจำปี
            var holidayData = {}
            if (
                moment(startDate).format('YYYY') ==
                moment(endDate).format('YYYY')
            ) {
                //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
                var _tmpHoliday = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData = _tmpHoliday.data()
            } else {
                //กรณีดึงข้อมูลข้ามปี
                var _tmpHolidayStart = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                var _tmpHolidayEnd = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData['Holiday'] = _tmpHolidayStart
                    .data()
                    .Holiday.concat(_tmpHolidayEnd.Holiday)
                holidayData['HolidayName'] = _tmpHolidayStart
                    .data()
                    .HolidayName.concat(_tmpHolidayEnd.HolidayName)
            }

            //นับวันที่ทำงาน ขาด ลา มาสาย
            const currentMomentPeruser = moment(startDate).locale('th')
            const endMomentPeruser = moment(endDate).locale('th').add(1, 'day')
            const checkIn = await getCheckIn(userId,
                compId,
                _docStandardProfile,
                startDate,
                endDate)
            const checkOut = await getCheckOut(userId,
                compId,
                startDate,
                endDate)
            const leaveDoc = await getLeave(userId,
                compId,
                startDate,
                endDate)
            const lateDoc = await getLate(userId,
                compId,
                startDate,
                endDate)

            //ดึงข้อมูล OT 
            const overTimeDoc = await getOverTime(userId,
                compId,
                startDate,
                endDate)
            console.log('overTimeDoc', overTimeDoc);

            //ดึงข้อมูลกะ
            console.log('userId', userId);
            const employeeShitfDoc = await getEmployeeShitf(userId,
                compId,
                startDate,
                endDate)
            console.log('employeeShitfDoc', employeeShitfDoc);

            //ดึงข้อมูล ประกาศงาน 
            const jobDoc = await getJob(userId,
                compId,
                startDate,
                endDate)
            console.log('jobDoc', jobDoc);



            var CountDateCheckIn = 0; //นับวันทำงาน
            var CountLate = 0; //นับครั้งมาสาย
            var SumLateTime = 0; //นับนาทีมาสาย
            var CountDateWeekend = 0; //นับวันหยุดประจำสัปดาห์
            var CountLeave = 0; //นับวันลา
            var CountNotWork = 0; //นับวันขาดงาน
            var CountHoliday = 0; //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var SumDayNoMoney = 0 //รวมเงินลาประเภทที่ไม่ได้รับเงิน
            var arrLeave = [] //เก็บข้อมูลประเภทการลาที่ไม่ได้รับเงิน

            //วนนับวันทำงาน
            while (currentMomentPeruser.isBefore(endMomentPeruser, 'day')) {
                var CountDayla = false  ////ตัวแปรเช็ควันลา

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
                var timePleaseLate = 0
                var findLate = lateDoc.find((ele) => moment.tz(ele.DateTimeLate.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'))

                if(findLate != undefined){
                    var timeLateUser = moment.tz(findLate.DateTimeLate.toDate(), 'Asia/Bangkok').format('HH:mm')
                    var timeCheckInProfile = moment('2022-01-01 ' + _docStandardProfile.TimeIn).toDate()
                    var timeCheckInLate = moment('2022-01-01 ' + timeLateUser).toDate()

                    var diffLate = timediff(timeCheckInProfile, timeCheckInLate)
                    // console.warn('diffLate -> ', diffLate);
                    timePleaseLate = (diffLate.hours * 60) + diffLate.minutes
                }

                timePleaseLate = Number(timePleaseLate) + Number(profileTimeLate)

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//

                var _tmpCheckLate = false
                var checkInShow = '-'
                //หาเช็คอินแรกสุด
                var finded = checkIn.find(
                    (ele) =>
                        moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //หาเข็คเอ้าสุดท้าย เรียงเอ้าสุดท้ายจาก getCheckOut แล้ว
                var findedCheckOut = checkOut.find(
                    (ele) =>
                        moment(ele.CheckOutTime.toDate()).tz('Asia/Bangkok').format(
                            'YYYY-MM-DD'
                        ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //ถ้ามีการเช็คอิน

                if (finded != undefined) {
                    //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                    var jobHave = false; //พนักงานมีเข้างานในการประกาศงานหรือไม่
                    var jobLate = 0; //พนักงานเข้าสาย
                    var jobLateTime = 0; //พนักงานเข้าสายนาที
                    if (jobDoc.length > 0) {
                        //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                        var findedJob = jobDoc.find(ele => ele.StartDate == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->findedJob', findedJob);
                        if (findedJob != undefined) {
                            jobHave = true;
                            var latediff = moment.tz(finded.CheckInTime.toDate(), 'Asia/Bangkok').diff(moment.tz(findedJob.StartDate + ' ' + findedJob.StartTime, 'Asia/Bangkok'), 'minutes');
                            // console.log('-->latediff', latediff);
                            if (latediff > timePleaseLate) {
                                jobLate = 1;
                                jobLateTime = latediff
                            }
                        }
                    }

                    //ตรวจสอบว่าวันนี้มี กะหรือไม่ 
                    var shiftHave = false; //พนักงานมีเข้างานในกะหรือไม่
                    var shiftLate = 0; //พนักงานเข้ากะแล้วสายครั้ง
                    var shiftLateTime = 0; //พนักงานเข้ากะสายนาที
                    if (employeeShitfDoc.length > 0) {
                        var findedShitf = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        if (findedShitf != undefined) {
                            shiftHave = true;
                            var latediff = moment.tz(finded.CheckInTime.toDate(), 'Asia/Bangkok').diff(moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'), 'minutes');
                            console.log('-->latediff', latediff);
                            if (latediff > timePleaseLate) {
                                shiftLate = 1;
                                shiftLateTime = latediff
                            }
                        }
                    }


                    //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                    if (jobHave) {
                        //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (jobLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(jobLateTime)
                        }
                        if (shiftHave == true) { //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                            SumShiftDay += 1;
                            SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                        }
                    } else if (shiftHave == true) { //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                        SumShiftDay += 1;
                        SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                        //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (shiftLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(shiftLateTime)
                        }
                    } else { //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                        //กรณีมีสาย
                        if (finded.LateCount != undefined) {
                            if(Number(finded.LateTimeMinite) > timePleaseLate){
                                lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(finded.LateTimeMinite)
                            }
                        }
                    }
                    //นับวันทำงาน
                    CountDateCheckIn++
                    checkInShow = moment(finded.CheckInTime.toDate()).format('เข้า HH:mm ')
                }

                if (findedCheckOut != undefined) {
                    //กรณีมีเช็คอิน
                    checkInShow =
                        checkInShow +
                        moment(findedCheckOut.CheckOutTime.toDate()).format(
                            ' - ออก HH:mm'
                        )
                }

                //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                var _tmpThisWeekend = false
                if (
                    _docStandardProfile.Weeked.Mon == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Mon'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Tue == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Tue'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Wed == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Wed'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Thu == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Thu'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Fri == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Fri'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sat == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Sat'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sun == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') ==
                    'Sun'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }

                //เช็คว่าเป็นวันหยุดพิเศษไหม
                var _findedHolidaData = holidayData.Holiday.find(
                    (ele) =>
                        ele == moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                )

                //คำนวนโอที
                if (overTimeDoc.length > 0) {
                    var findedOverTime = overTimeDoc.find(ele => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                    var filterDataOT = overTimeDoc.filter((ele) => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                    )

                    if (filterDataOT.length > 0) {

                        var sumHoursOT = 0
                        var sumMinutesOT = 0
                        for (let indexOT = 0; indexOT < filterDataOT.length; indexOT++) {
                            var itemOT = filterDataOT[indexOT];
                            sumHoursOT += itemOT.sumHours
                            sumMinutesOT += itemOT.sumMinutes
                        }

                        var sumAllOT = Number(sumHoursOT + '.' + sumMinutesOT)

                        var _otType = 'โอทีวันทำงานปกติ';
                        if (_findedHolidaData != undefined) {
                            _otType = 'โอทีวันหยุดพิเศษ';
                        } else if (_tmpThisWeekend == true) {
                            _otType = "โอทีวันหยุดประจำสัปดาห์";
                        }

                        if(shiftHave == true){
                            _otType = 'โอทีวันทำงานปกติ';
                        }

                        var _obj = {
                            salary: salary,
                            otHour: sumAllOT,
                            otType: _otType,
                            empType: employeeTypeId, //พนักงานรายวัน
                        }
                        console.log('==>__obj', _obj);
                        var _money = await calOTIncome(_docStandardProfile, _obj)
                        console.log('==>_money', _money);
                        SumOTHour += Number(sumAllOT)
                        SalaryOT += Number(_money)
                    }

                }

                //เช็คว่าลาหรือไม่
                var findedLeave = leaveDoc.find(
                    (ele) =>
                        moment(currentMomentPeruser).isBetween(
                            moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD'),
                            moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                        ) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') ==
                        moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format(
                            'YYYY-MM-DD'
                        ) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') ==
                        moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                )


                // console.log('findedLeave',findedLeave);
                if (findedLeave != undefined) {

                    if (findedLeave.LeaveTypeData.Wages == 'ไม่ได้รับค่าจ้าง') {
                        var findArrLeave = arrLeave.findIndex((ele) => ele.LeaveID == findedLeave.LeaveID)
                        if (findArrLeave == -1) {
                            var cutLeaveDay = 0
                            var cutLeaveHours = 0
                            var cutLeaveMinutes = 0

                            if (findedLeave.Cut_Day > 0) {
                                cutLeaveDay = (salary / 30) * findedLeave.Cut_Day
                                
                            }

                            if (findedLeave.Cut_Hours > 0) {
                            var LeaveHours = (salary / 30)
                            cutLeaveHours = LeaveHours / 9 * findedLeave.Cut_Hours
                            }
                            if (findedLeave.Cut_Minutes > 0) {
                                var LeaveMinutes = (salary / 30)
                                var _LeaveMinutes = LeaveMinutes / 9
                                cutLeaveMinutes = _LeaveMinutes / 2
                            }

                            arrLeave.push(findedLeave)

                            var sumUnpaid = cutLeaveDay + cutLeaveHours + cutLeaveMinutes
                            
                            SumDayNoMoney += sumUnpaid
                            console.log('วันลาที่ไม่ได้เงิน else', SumDayNoMoney);
                        }
                        
                    }

                    CountLeave++

                    //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                    if (finded != undefined) {
                        CountDateCheckIn--
                        var _diffLeave = timediff(
                            findedLeave.StartDateTime.toDate(),
                            findedLeave.EndDateTime.toDate(),
                            'Hm'
                        )
                        var _tmpLeaveHour = ''
                        if (_diffLeave.hours < 9) {
                            _tmpLeaveHour =
                                '' +
                                _diffLeave.hours +
                                '.' +
                                _diffLeave.minutes +
                                ' ชม.' +
                                '\n'
                        }

                        if (_tmpCheckLate == true) {
                            //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                            CountLate--
                            SumLateTime -= Number(finded.LateTimeMinite)
                        }
                    }

                    if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '1') {
                        // var getLeave = 
                        // console.log('ค่าแรงในวันลา');
                        CountDateCheckIn++
                    } else if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '0' || _docStandardProfile.UseLeaveMoney == undefined) {
                        console.log('ไม่ได้ค่าแรงในวันลา');
                    }
                } else {
                    //ถ้าไม่ใช่ลา
                    if (_tmpThisWeekend == false && checkInShow == '-') {

                        if (_findedHolidaData != undefined) {
                            //ถ้าเป็นวันหยุดพิเศษ ไม่นับว่าขาดงาน
                            if (checkInShow != '-') { //ถ้ามีมาทำงานวันหยุดพิเศษให้นับวันจำนวนวันหยุดพิเศษ
                                CountHoliday++
                            }
                        } else {
                            //ถ้าเป็นวันทำงานปกติ ให้นับว่าขาด
                            if(checkInShow == '-'){
                                CountDayla = true
                                CountNotWork++
                            }
                        }

                    }
                }

                if (finded == undefined && _findedHolidaData == undefined) {
                    //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่ 
                    var findedShitf2 = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD'));

                    if (findedShitf2 != undefined && findedLeave == undefined) { //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                        if(CountDayla != true){
                            CountNotWork++
                        }
                    }
                }

                currentMomentPeruser.add(1, 'days')
            }
            //คำนวนเงินเดือน
            if (employeeTypeId == 2) {
                //พนักงานรายวัน
                salary = salary * CountDateCheckIn
            } else {
                //พนักงานรายเดือน
                salary = salary
            }

            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('datadatadata/////', salary);
            }


            console.log('CountLate', CountLate);
            console.log('SumLateTime', SumLateTime);


            //คิดเงินประกันสังคม ถ้าไม่ติ๊กใช้งานคือไม่คิดเงินประกันสังคม
            var resM33 = 0
            if (_docStandardProfile.UseCutM33 != undefined) {
                if (_docStandardProfile.UseCutM33 == 1) {
                    var dataCalM33 = {
                        salary: salary,
                        percent: Number(_docStandardProfile.M33Rate),
                    }
                    resM33 = calM33(dataCalM33)
                }
            }

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('CountNotWork -> ', CountNotWork);
            }

            var resAbsent = 0

            if (docUser.EmployeeTypeID == 1 || docUser.EmployeeTypeName == 'พนักงานประจำ') {
                resAbsent = await calAbsent(CountNotWork, compId, userId, profileId, salary, SumLateTime);
            }

            var tax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }
            // console.log('docUser.TawitUse', docUser.TawitUse);

            //----------------คำนวณภาษีแบบเก่า------------------//
            // if (docUser.TawitUse == 1) {
            //     //ถ้าคิดภาษีเงินได้บุคคลธรรมดา
            //     tax = await calTax({
            //         salary: salary,
            //         moneyPay: 100000,
            //         deduc: 60000,
            //         m33: resM33 * 12,
            //     })
            // }

            //---------------คำนวณภาษีแบบเก่า--------------------//

            //------------------วันลาที่ไม่ได้เงิน--------------------//
            // console.log('รวม else', SumDayNoMoney);
            if (SumDayNoMoney > 0) {
                resAbsent += Number(SumDayNoMoney) + Number(resAbsent)
                // console.log('5555 else', resAbsent);
            }
            
            //------------------วันลาที่ไม่ได้เงิน--------------------//

            dataForSavePayRoll = {
                ExpenseHintTextList: [
                    'ภาษี ' + numeral(tax.taxPerMonth).format('0,0.00') + ' บาท',
                    'WHT 0.00 บาท',
                    'ประกันสังคม ' + numeral(resM33).format('0,0.00') + ' บาท',
                    'สายขาดลา ' + numeral(resAbsent).format('0,0.00') + ' บาท',
                    'หักอื่นๆ 0.00 บาท',
                    'รายได้รับล่วงหน้า 0.00 บาท',
                ],
                ExpenseMoneyTextList: [
                    '' + tax.taxPerMonth,
                    '0.00',
                    '' + resM33,
                    '' + resAbsent,
                    '0.00',
                    '0.00',
                ],
                ExpenseNameTextList: [
                    'ภาษี',
                    'WHT',
                    'ประกันสังคม',
                    'สายขาดลา',
                    'หักอื่นๆ',
                    'รายได้รับล่วงหน้า',
                ],
                IncomeHintTextList: [
                    'เงินเดือน ' + numeral(salary).format('0,0.00') + ' บาท',
                    'เบี้ยขยัน 0.00 บาท',
                    'โอที 0.00 บาท',
                    'คอมมิชชั่น 0.00 บาท',
                    'โบนัส 0.00 บาท',
                    'รายได้อื่นๆ 0.00 บาท',
                ],
                IncomeMoneyTextList: [
                    '' + salary,
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                ],
                IncomeNameList: [
                    'เงินเดือน',
                    'เบี้ยขยัน',
                    'โอที',
                    'คอมมิชชั่น',
                    'โบนัส',
                    'รายได้อื่นๆ',
                ],
                OtherHintTextList: [
                    'รายได้สะสม 0.00 บาท',
                    'ภาษีสะสม 0.00 บาท',
                    'WHT สะสม 0.00 บาท',
                    'ประกันสังคมสะสม 0.00 บาท',
                ],
                OtherMoneyTextList: ['0.00', '0.00', '0.00', '0.00'],
                OtherNameTextList: [
                    'รายได้สะสม',
                    'ภาษีสะสม',
                    'WHT สะสม',
                    'ประกันสังคมสะสม',
                ],
                SetUserId: userId,
            }

            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////

            if(listExtraMoney.ExpenseHintTextList.length > 0){
                dataForSavePayRoll['ExpenseHintTextList'].push(...listExtraMoney.ExpenseHintTextList)
            }
            if(listExtraMoney.ExpenseMoneyTextList.length > 0){
                dataForSavePayRoll['ExpenseMoneyTextList'].push(...listExtraMoney.ExpenseMoneyTextList)
            }
            if(listExtraMoney.ExpenseNameTextList.length > 0){
                dataForSavePayRoll['ExpenseNameTextList'].push(...listExtraMoney.ExpenseNameTextList)
            }

            if(listExtraMoney.IncomeHintTextList.length > 0){
                dataForSavePayRoll['IncomeHintTextList'].push(...listExtraMoney.IncomeHintTextList)
            }
            if(listExtraMoney.IncomeMoneyTextList.length > 0){
                dataForSavePayRoll['IncomeMoneyTextList'].push(...listExtraMoney.IncomeMoneyTextList)
            }
            if(listExtraMoney.IncomeNameList.length > 0){
                dataForSavePayRoll['IncomeNameList'].push(...listExtraMoney.IncomeNameList)
            }
            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('resAbsent -> ', resAbsent);
            }

            if (SalaryOT > 0 && SumOTHour > 0) {
                dataForSavePayRoll.IncomeHintTextList[2] = 'โอที ' + numeral(Number(SalaryOT)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.IncomeMoneyTextList[2] = '' + numeral(Number(SalaryOT)).format('0.00');
            }

            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('datadatadata/////ฟฟฟฟฟฟฟฟ', salary);
            }

            // income = salary;
            // expense = Number(tax.taxPerMonth) + Number(resM33);

            if (addMoneyExtra != undefined) {
                //ถ้ามีสั่งเพิ่มเงินพิเศษ
                dataForSavePayRoll.IncomeHintTextList.push(
                    addMoneyExtra.Name +
                    ' ' +
                    numeral(Number(addMoneyExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.IncomeMoneyTextList.push(
                    numeral(Number(addMoneyExtra.Money)).format('0.00')
                )
                dataForSavePayRoll.IncomeNameList.push(addMoneyExtra.Name)
            }

            if (addExpenseExtra != undefined) {
                //ถ้ามีสั่งหักเงินพิเศษ
                dataForSavePayRoll.ExpenseHintTextList.push(
                    addExpenseExtra.Name +
                    ' ' +
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.ExpenseMoneyTextList.push(
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00')
                )
                dataForSavePayRoll.ExpenseNameTextList.push(addExpenseExtra.Name)
            }

            //เช็กเพื่อเติมเบี้ยขยันก่อน
            //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
            console.log('==>SalaryDiligent', SalaryDiligent);
            if (SalaryDiligent > 0) {
                dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
            }
            console.log('==>SalaryLiving', SalaryLiving);
            //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
            if (SalaryLiving > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าครองชีพ');
                console.log('==>finded', finded);
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                } else { //ถ้ามี
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryLiving)).format('0.00');
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                }
            }

            //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
            console.log('==>SalaryPosition', SalaryPosition);
            if (SalaryPosition > 0) {
                //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าตำแหน่ง');
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                } else { //ถ้ามี
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryPosition)).format('0.00');
                }
            }

            //ถ้ามีรายได้ค่ากะ ให้เติมข้อมูลใน array
            if (SalaryShift > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่ากะ');
                console.log('==>finded', finded);
                if (finded == -1) { //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push('ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท');
                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryShift)).format('0.00'));
                    dataForSavePayRoll.IncomeNameList.push('ค่ากะ');
                } else { //ถ้ามี
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SalaryShift)).format('0.00');
                    console.log('==>dataForSavePayRoll.IncomeHintTextList[finded]', dataForSavePayRoll.IncomeHintTextList[finded]);
                }
            }

            // หักเงินมาสาย
            if (CountLate > 0 && SumLateTime > 0) {
                //ถ้ากลุ่มนี้มีตั้งเงื่อนไขสายแล้วหักเงิน
                if (_docStandardProfile.UseTimeLateCutMoney == '1') {
                    if (SumLateTime > 0) {
                        var lateMinite = SumLateTime;
                        var late = 1;

                        //เช็คว่าใช้ เงื่อนไขหักเงินมาสายจากเบี้ยขยัน ค่าครองชีพ ค่าตำแหน่ง หรือไม่
                        if (_docStandardProfile.UseTimeLateCutMoneyExtra == '1') {
                            if (_docStandardProfile.chipExtraMoney != undefined) {

                                var moneyForCutLate = 0; //จำนวนเงินสำหรับตัด
                                if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                    //หักเป็นบาท ต่อ ชม.
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)

                                } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                    //หักสูตรคิดเงินเดือน
                                    var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_moneyPerDay)

                                }
                                //เอามาเช็คว่าใน array มีการเพิ่มค่าเบี้ยเลี้ยง ค่าครองชีพ ค่าตำแหน่ง เข้าไปใน array หรือยัง ถ้ายัง ให้เอาให้เพิ่มต่อกรณีที่มีการกำหนดจำนวนเงินมา
                                var checkHaveSalaryDiligent = false;
                                var checkHaveSalaryLiving = false;
                                var checkHaveSalaryPosition = false;
                                if (moneyForCutLate > 0) {


                                    //ให้ทำการ วน ตัดจากลำดับที่เลือกไว้
                                    for (var ic = 0; ic < _docStandardProfile.chipExtraMoney.length; ic++) {
                                        var chipExtra = _docStandardProfile.chipExtraMoney[ic];
                                        if (chipExtra == 'เบี้ยขยัน' && SalaryDiligent > 0) {
                                            console.log('chipExtra', chipExtra);
                                            //เบี้ยขยันลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryDiligent > moneyForCutLate) {
                                                checkHaveSalaryDiligent = true;
                                                //ถ้าเบี้ยขยัน > เงินที่ตั้งตัด
                                                result = SalaryDiligent - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(result)).format('0.00');

                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                checkHaveSalaryDiligent = true;
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryDiligent
                                                dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(result)).format('0.00');
                                            }

                                        } else if (chipExtra == 'ค่าครองชีพ' && SalaryLiving > 0) {
                                            console.log('chipExtra', chipExtra);
                                            //ค่าครองชีพลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryLiving > moneyForCutLate) {
                                                checkHaveSalaryLiving = true;
                                                //ถ้าค่าครองชีพ > เงินที่ตั้งตัด
                                                result = SalaryLiving - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryLiving = true;
                                                moneyForCutLate = moneyForCutLate - SalaryLiving
                                                dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                            }

                                        } else if (chipExtra == 'ค่าตำแหน่ง' && SalaryPosition > 0) {
                                            console.log('chipExtra', chipExtra);
                                            //ค่าตำแหน่งลบเงินที่มาสาย 
                                            var result = 0;
                                            if (SalaryPosition > moneyForCutLate) {
                                                checkHaveSalaryPosition = true;
                                                //ถ้าค่าตำแหน่ง > เงินที่ตั้งตัด
                                                result = SalaryPosition - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                                break; //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryPosition = true;
                                                moneyForCutLate = moneyForCutLate - SalaryPosition
                                                dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(result)).format('0,0.00') + ' บาท');
                                                dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(result)).format('0.00'));
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                            }
                                        } else if (chipExtra == 'เงินเดือน') {
                                            console.log('chipExtra', chipExtra);
                                            //เบี้ยขยันลบเงินที่มาสาย 
                                            var result = 0;
                                            result = salary - moneyForCutLate
                                            console.log('result', numeral(Number(result)).format('0,0.00'));

                                            dataForSavePayRoll.IncomeHintTextList[0] = 'เงินเดือน ' + numeral(Number(result)).format('0,0.00') + ' บาท';
                                            dataForSavePayRoll.IncomeMoneyTextList[0] = numeral(Number(result)).format('0.00').toString();
                                            console.log('dataForSavePayRoll.IncomeMoneyTextList[0]', dataForSavePayRoll.IncomeMoneyTextList[0]);

                                            break; //ตัดปกติจบ ตัดรอบเดียว

                                        }
                                    }
                                }

                                //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                                if (checkHaveSalaryDiligent == false && SalaryDiligent > 0) {
                                    dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
                                    dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
                                }

                                //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                                if (checkHaveSalaryLiving == false && SalaryLiving > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                                }

                                //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                                if (checkHaveSalaryPosition == false && SalaryPosition > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                                    dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                                }



                            }
                        } else { //ถ้าไม่ได้ตั้งหักตามลำดับ



                            if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                //หักเป็นบาท ต่อ ชม.
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                dataForSavePayRoll.ExpenseHintTextList[3] = 'สายขาดลา ' + numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.ExpenseMoneyTextList[3] = '' + numeral(Number(lateLeaveMoney + resAbsent)).format('0.00');
                            } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                //หักสูตรคิดเงินเดือน
                                var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_moneyPerDay)
                                dataForSavePayRoll.ExpenseHintTextList[3] = 'สายขาดลา ' + numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.ExpenseMoneyTextList[3] = '' + numeral(Number(lateLeaveMoney + resAbsent)).format('0.00');
                            }
                        }

                    }
                } else {
                    //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                    if (SalaryDiligent > 0) {
                        dataForSavePayRoll.IncomeHintTextList[1] = 'เบี้ยขยัน ' + numeral(Number(SalaryDiligent)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.IncomeMoneyTextList[1] = '' + numeral(Number(SalaryDiligent)).format('0.00');
                    }

                    //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                    if (SalaryLiving > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push('ค่าครองชีพ ' + numeral(Number(SalaryLiving)).format('0,0.00') + ' บาท');
                        dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryLiving)).format('0.00'));
                        dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ');
                    }

                    //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                    if (SalaryPosition > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push('ค่าตำแหน่ง ' + numeral(Number(SalaryPosition)).format('0,0.00') + ' บาท');
                        dataForSavePayRoll.IncomeMoneyTextList.push('' + numeral(Number(SalaryPosition)).format('0.00'));
                        dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง');
                    }
                }
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }

             //---------------------คำนวณภาษีแบบใหม่--------------------//
             var newTax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }
            if(docUser.TawitUse == 1){
                newTax = await calTax({
                    compId: compId,
                    salary: income,
                    moneyPay: 100000,
                    deduc: 60000,
                    m33: resM33 * 12,
                })
                // console.log('newTax -> ', newTax);
                dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(newTax.taxPerMonth)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(newTax.taxPerMonth)).format('0.00');

                if(Number(newTax.taxPerMonth) > 0){
                    expense += Number(newTax.taxPerMonth)
                }
            }
            //---------------------คำนวณภาษีแบบใหม่--------------------//

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )

            var RetainedIncome = 0
            var accumulatedTax = 0
            var cumulativeWHT = 0
            var socialSecurity = 0
            //คิวรี่ PayrollTransferSuccess เพื่อหารายได้สะสมของพนักงานแต่ละคน
            await db.collection(compId + 'PayrollTransferSuccess')
                .orderBy('Timestamp', "desc")
                .limit(1)
                .get()
                .then(async(querySnapshot) => {
                    console.log('xoxoxoxo if', querySnapshot.docs.length);
                    if (querySnapshot.docs.length > 0) {

                            var itemPayrollTransfer = querySnapshot.docs[0].data()
                            
                            var docTransfer = itemPayrollTransfer.Transfer.filter((ele) => ele.UserID == userId)
                            console.log('docTransfer-->>if', docTransfer);
                            if (docTransfer.length > 0) {
                                docTransfer.sort((a, b) => a.PayDate.localeCompare(b.PayDate))
                                //   console.log('>>>>>>', docTransfer);
                                var itemTransfer = docTransfer[docTransfer.length-1]
                                // console.log('>>>>>>>>>>>', itemTransfer);
                                /// split EndDate
                                var splitTimeStamp = itemTransfer.EndDate.split('-')
                                var arMonth = splitTimeStamp[1]
                                // var arYear = splitTimeStamp[0]
                                // var arDay = splitTimeStamp[2]

                                ///split PayDate
                                var split_payDate = itemTransfer.PayDate.split('-')
                                var arYearPayDate = split_payDate[0]
                                var arMonthPayDate = split_payDate[1]
                                var arDayPayDate = split_payDate[2]

                                var convert_payDate = moment(payDate).toDate()
                                var convertPayDate = moment(itemTransfer.PayDate).toDate()
                                // console.log('%%%%%%%%%', convert_payDate, convertPayDate);
                                // console.log('@@@@@@@@@', payDate, itemTransfer.PayDate);

                                if (payDate != itemTransfer.PayDate && convert_payDate > convertPayDate) {

                                    var dataPayDate = itemTransfer.UserID + '_' + arYearPayDate + arMonthPayDate + arDayPayDate
                                    // console.log('xoxoxoxo', dataPayDate);
                                    await db.collection(compId + 'Payroll')
                                    .doc(dataPayDate)
                                    .get()
                                    .then(async(queryPayroll) => {
                                        if (queryPayroll.data() != undefined ) {
                                            var item_Payroll = queryPayroll.data()
                                            var oSalary = item_Payroll.OtherMoneyTextList[0]
                                            // console.warn('AAA', oSalary);
                                            var oTax = item_Payroll.OtherMoneyTextList[1]
                                            // console.warn('BBB', oTax);
                                            var oWHT = item_Payroll.OtherMoneyTextList[2]
                                            // console.warn('CCC', oWHT);
                                            var oSocialMoney = item_Payroll.OtherMoneyTextList[3]
                                            // console.warn('DDD', oSocialMoney);
                                            // console.log('income', income);
                                            RetainedIncome = Number(oSalary) + income
                                            // console.log('รายได้สะสม', RetainedIncome);
                                            accumulatedTax = Number(oTax) + Number(dataForSavePayRoll.ExpenseMoneyTextList[0])
                                            // console.log('ภาษีสะสม', accumulatedTax);
                                            cumulativeWHT = Number(oWHT) + Number(dataForSavePayRoll.ExpenseMoneyTextList[1])
                                            // console.log('WHT สะสม', cumulativeWHT);
                                            socialSecurity = Number(oSocialMoney) + Number(dataForSavePayRoll.ExpenseMoneyTextList[2])

                                            // console.log('ประกันสังคมสะสม', socialSecurity);
                                            
                                            // console.log('======>', dataForSavePayRoll);
                                            var splitEndDate = endDate.split('-')
                                            var startMonth = splitEndDate[1]
                                            // console.log('&&&&&&', startMonth);

                                            if (startMonth == '01' && arMonth != '01') {
                                                // console.log('#######');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                                            }else{
                                                // console.log('*******');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(RetainedIncome)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(RetainedIncome)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(accumulatedTax)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(accumulatedTax)).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(cumulativeWHT)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(cumulativeWHT)).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(socialSecurity)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(socialSecurity)).format('0.00');
                                            }
                                        }
                                    })
                                }

                                
                            }else{
                                // console.log('1-------------------1--if');
                                // รายได้สะสม
                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                // ภาษีสะสม
                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                // WHT สะสม
                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                // ประกันสังคมสะสม
                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                            }  
                    }else{
                        // console.log('2------------------2---if');
                        // รายได้สะสม
                        dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                        // ภาษีสะสม
                        dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                        // WHT สะสม
                        dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                        // ประกันสังคมสะสม
                        dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                    }
                })

            netmoney = Number(Number(income - expense).toFixed(2))
        }

        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .set(dataForSavePayRoll)

        //ใส่ข้อมูลเบิ้ลเพื่อเอาไปแสดงในแอพด้วย
        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .set(dataForSavePayRoll)

        await db
            .collection(compId + 'User')
            .doc(userId)
            .update({ LateTime: CountLate })

        var result = {
            income: income,
            expense: expense,
            netmoney: netmoney,
            userId: userId,
            compId: compId,
            startDate: startDate,
            endDate: endDate,
            payDate: payDate,
            tmpDatePay: _tmpDatePay,
            CountNotWork: CountNotWork,
        }

        return result
    } else {
        return 'no data send'
    }
})

//รีพอร์ต Payroll แบบแจงยอดใหม่
exports.apiPayrollClarify = functions.https.onCall(async (data, context) => {
    if (data != undefined) {
        const userId = data.userId //user id
        const compId = data.compId //company code
        const startDate = data.startDate //วันเริ่มต้นคิดเงิน
        const endDate = data.endDate //วันสิ้นสุดคิดเงิน
        const payDate = data.payDate //วันที่จ่ายเงิน
        const profileId = data.profileId // Standdard Profile กลุ่มพนักงาน
        const docUser = data.docUser
        var employeeTypeId = docUser.EmployeeTypeID // ประเภทพนักงาน 1 = รายเดือน 2 = รายวัน 3 = รายชม.
        const addMoneyExtra = data.addMoneyExtra //ถ้ามีเพิ่มเงินพิเศษ
        const addExpenseExtra = data.addExpenseExtra //ถ้ามีหักเงินพิเศษ
        const calNew = data.calNew //ถ้า เป็น 1 =สั่งคำนวนเงินเดือนใหม่

        //ถ้าเป็นceo ถือว่าเป็นรายเดือนทันที
        if (employeeTypeId == undefined || employeeTypeId == null) {
            employeeTypeId = 1
        }

        // if (userId == 'Auz5ETJmpo1Lp1UPYwxw') {
        //     console.log('datadatadata เงินเดือน', docUser.Salary)
        // }

        var salary = docUser.Salary
        var income = 0
        var expense = 0
        var netmoney = 0
        var lateLeaveMoney = 0
        var CountWorking = 0
        var listExtraMoney = {
            ExpenseHintTextList: [],
            ExpenseMoneyTextList: [],
            ExpenseNameTextList: [],
            IncomeHintTextList: [],
            IncomeMoneyTextList: [],
            IncomeNameList: [],
        }

        // console.log('Salary == ', salary);
        // console.log('docUser.SalaryDiligent', docUser.SalaryDiligent);
        // console.log('docUser.SalaryLiving', docUser.SalaryLiving);
        // console.log('docUser.SalaryPosition', docUser.SalaryPosition);
        // console.log('isNaN(Number(docUser.SalaryDiligent)))', isNaN(Number(docUser.SalaryDiligent)));
        // console.log('isNaN(Number(docUser.SalaryLiving)))', isNaN(Number(docUser.SalaryLiving)));
        // console.log('isNaN(Number(docUser.SalaryPosition)))', isNaN(Number(docUser.SalaryPosition)));
        //เบี้ยขยัน
        var SalaryDiligent = 0
        if (
            docUser.SalaryDiligent != undefined &&
            isNaN(Number(docUser.SalaryDiligent)) == false
        ) {
            SalaryDiligent = Number(docUser.SalaryDiligent)
        }
        //ค่าครองชีพ
        var SalaryLiving = 0
        if (
            docUser.SalaryLiving != undefined &&
            isNaN(Number(docUser.SalaryLiving)) == false
        ) {
            SalaryLiving = Number(docUser.SalaryLiving)
        }

        //ค่าตำแหน่ง
        var SalaryPosition = 0
        if (
            docUser.SalaryPosition != undefined &&
            isNaN(Number(docUser.SalaryPosition)) == false
        ) {
            SalaryPosition = Number(docUser.SalaryPosition)
        }

        var SalaryOT = 0 //ค่าโอที
        var SumOTHour = 0 //รวมชม.โอที

        var SalaryShift = 0 //ค่ากะ
        var SumShiftDay = 0 //รวมเข้ากะกี่วัน

        var _tmpDatePay = moment(payDate).format('YYYYMMDD')
        var _tmpDatePayMonthOnly = moment(payDate).format('YYYYMM')

        var docStandardProfile = await db
            .collection(compId + 'StandardProfile')
            .doc(profileId)
            .get()
        var _docStandardProfile = docStandardProfile.data()

        var docTaxDeduction = await db
            .collection(compId + 'TaxDeduction')
            .doc(userId + '_' + _tmpDatePay)
            .get()
        // var _docTaxDeduction = docTaxDeduction.data()
        // console.log('_docTaxDeduction', _docTaxDeduction)

        var docPayroll = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .get()

        var docPayrollMonth = await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .get()

        if(docPayrollMonth.data() != undefined){
            var payrollMonth = docPayrollMonth.data()
            console.log('payrollMonth Jay => ', payrollMonth.ExpenseHintTextList.length , payrollMonth.IncomeHintTextList.length);

            if(payrollMonth.ExpenseHintTextList.length > 0){
                for (let Ex = 0; Ex < payrollMonth.ExpenseHintTextList.length; Ex++) {
                    console.log('loop Ex = ', Ex);
                    if(Ex > 5){
                        listExtraMoney['ExpenseHintTextList'].push(payrollMonth.ExpenseHintTextList[Ex])
                        listExtraMoney['ExpenseMoneyTextList'].push(payrollMonth.ExpenseMoneyTextList[Ex])
                        listExtraMoney['ExpenseNameTextList'].push(payrollMonth.ExpenseNameTextList[Ex])
                    }
                }
            }

            console.log('listExtraMoney Jay => ', listExtraMoney);

            if(payrollMonth.IncomeHintTextList.length > 0){
                for (let In = 0; In < payrollMonth.IncomeHintTextList.length; In++) {
                    console.log('loop In = ', In);
                    if(In > 5){
                        listExtraMoney['IncomeHintTextList'].push(payrollMonth.IncomeHintTextList[In])
                        listExtraMoney['IncomeMoneyTextList'].push(payrollMonth.IncomeMoneyTextList[In])
                        listExtraMoney['IncomeNameList'].push(payrollMonth.IncomeNameList[In])
                    }
                }
            }

            console.log('listExtraMoney Jay => ', listExtraMoney);
        }

        var dataForSavePayRoll = {}

        var profileTimeLate = 0 //กี่นาทีถึงจะเริ่มนับสาย
        if (_docStandardProfile.UseTimeLateCutMoney == '1') {
            profileTimeLate = _docStandardProfile.TimeLate
        }

        //คิดเงินแบบเดิม
        var jay = 0
        if (docPayroll.data() != undefined) {
            var CountLate = 0 //นับครั้งมาสาย
            dataForSavePayRoll = docPayroll.data()
            var holidayData = {}
            if (
                moment(startDate).format('YYYY') ==
                moment(endDate).format('YYYY')
            ) {
                //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
                var _tmpHoliday = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData = _tmpHoliday.data()
            } else {
                //กรณีดึงข้อมูลข้ามปี
                var _tmpHolidayStart = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                var _tmpHolidayEnd = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData['Holiday'] = _tmpHolidayStart
                    .data()
                    .Holiday.concat(_tmpHolidayEnd.Holiday)
                holidayData['HolidayName'] = _tmpHolidayStart
                    .data()
                    .HolidayName.concat(_tmpHolidayEnd.HolidayName)
            }

            const currentMomentPeruser = moment(startDate).locale('th')
            const endMomentPeruser = moment(endDate).locale('th').add(1, 'day')
            const checkIn = await getCheckIn(userId,
                compId,
                _docStandardProfile,
                startDate,
                endDate)

                const checkOut = await getCheckOut(userId,
                    compId,
                    startDate,
                    endDate)
                const leaveDoc = await getLeave(userId,
                    compId,
                    startDate,
                    endDate)
                const lateDoc = await getLate(userId,
                    compId,
                    startDate,
                    endDate)
    
                //ดึงข้อมูล OT 
                const overTimeDoc = await getOverTime(userId,
                    compId,
                    startDate,
                    endDate)

                const employeeShitfDoc = await getEmployeeShitf(userId,
                    compId,
                    startDate,
                    endDate)

                //ดึงข้อมูล ประกาศงาน 
                const jobDoc = await getJob(userId,
                    compId,
                    startDate,
                    endDate)

                var CountDateCheckIn = 0; //นับวันทำงาน
                var CountLate = 0; //นับครั้งมาสาย
                var SumLateTime = 0; //นับนาทีมาสาย
                var CountDateWeekend = 0; //นับวันหยุดประจำสัปดาห์
                var CountLeave = 0; //นับวันลา
                var CountNotWork = 0; //นับวันขาดงาน
                var CountHoliday = 0; //นับวันทำงานที่เป็นวันหยุดพิเศษ
                var CountWeekendWork = 0 //นับวันทำงานที่เป็นวันหยุดประจำสัปดาห์
                var CountHolidayWork = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
                var SumMoneyWeekend = 0 //รวมเงินที่ทำงานวันหยุดประจำสัปดาห์
                var SumMoneyHoliday = 0 //รวมเงินที่ทำงานวันหยุดพิเศษ
                while (currentMomentPeruser.isBefore(endMomentPeruser, 'day')) {
                    var CountDayla = false  ////ตัวแปรเช็ควันลา
                    // if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                    //     console.log('Log ก่อนตัดวันใหม่ ', SumLateTime);
                    // }

                    //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
                    var timePleaseLate = 0
                    var findLate = lateDoc.find((ele) => moment.tz(ele.DateTimeLate.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'))

                    if(findLate != undefined){
                        var timeLateUser = moment.tz(findLate.DateTimeLate.toDate(), 'Asia/Bangkok').format('HH:mm')
                        var timeCheckInProfile = moment('2022-01-01 ' + _docStandardProfile.TimeIn).toDate()
                        var timeCheckInLate = moment('2022-01-01 ' + timeLateUser).toDate()

                        var diffLate = timediff(timeCheckInProfile, timeCheckInLate)
                        // console.warn('diffLate -> ', diffLate);
                        timePleaseLate = (diffLate.hours * 60) + diffLate.minutes
                    }

                    timePleaseLate = Number(timePleaseLate) + Number(profileTimeLate)

                    //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
    
    
    
                    var _tmpCheckLate = false
                    var checkInShow = '-'
                    //หาเช็คอินแรกสุด
                    var finded = checkIn.find(
                        (ele) =>
                            moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                            moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )
    
                    // if (data.userId == 'Auz5ETJmpo1Lp1UPYwxw') {
                    //     console.log('findedfindedfindedfinded ->', finded);
                    // }
    
                    //หาเข็คเอ้าสุดท้าย เรียงเอ้าสุดท้ายจาก getCheckOut แล้ว
                    var findedCheckOut = checkOut.find(
                        (ele) =>
                            moment(ele.CheckOutTime.toDate()).tz('Asia/Bangkok').format(
                                'YYYY-MM-DD'
                            ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )
    
    
                    //ถ้ามีการเช็คอิน
                    if (finded != undefined) {
                        //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                        var jobHave = false; //พนักงานมีเข้างานในการประกาศงานหรือไม่
                        var jobLate = 0; //พนักงานเข้าสาย
                        var jobLateTime = 0; //พนักงานเข้าสายนาที
                        if (jobDoc.length > 0) {
                            //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                            var findedJob = jobDoc.find(ele => ele.StartDate == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                            // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                            // console.log('-->findedJob', findedJob);
                            if (findedJob != undefined) {
                                jobHave = true;
                                var latediff = moment.tz(finded.CheckInTime.toDate(), 'Asia/Bangkok').diff(moment.tz(findedJob.StartDate + ' ' + findedJob.StartTime, 'Asia/Bangkok'), 'minutes');
                                finded['LateTimeMinite'] = latediff
                                if (latediff > timePleaseLate) {
                                    jobLate = 1;
                                    jobLateTime = latediff
                                }
                            }
                        }
    
                        //ตรวจสอบว่าวันนี้มี กะหรือไม่ 
                        var shiftHave = false; //พนักงานมีเข้างานในกะหรือไม่
                        var shiftLate = 0; //พนักงานเข้ากะแล้วสายครั้ง
                        var shiftLateTime = 0; //พนักงานเข้ากะสายนาที
    
    
                        if (employeeShitfDoc.length > 0) {
                            console.log('currentMomentPeruser2222', currentMomentPeruser);
                            var findedShitf = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).tz('Asia/Bangkok').format('YYYY-MM-DD'));
                            if (findedShitf != undefined) {
                                shiftHave = true;
                                // if(data.userId == 'Auz5ETJmpo1Lp1UPYwxw'){
                                //     console.log('-->shiftHave latediff Auz5ETJmpo1Lp1UPYwxw1', finded.CheckInTime.toDate(), findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok');
                                // }
                                var beforConvert = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD');
                                var afterConvert = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').format('HH:mm');
                                // var latediff = moment(finded.CheckInTime.toDate()).tz('Asia/Bangkok').diff(moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'), 'minutes');
                                var latediff = moment.tz(beforConvert + ' ' + afterConvert, 'Asia/Bangkok').diff(moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'), 'minutes');
                                // if(data.userId == 'Auz5ETJmpo1Lp1UPYwxw'){
                                //     console.log('-->shiftHave latediff Auz5ETJmpo1Lp1UPYwxw2', moment.tz(beforConvert+' '+afterConvert,'Asia/Bangkok'), moment.tz(findedShitf.Day + " " + findedShitf.ShiftDetail.StartWorkingTime, 'Asia/Bangkok'));
                                // }
                                finded['LateTimeMinite'] = latediff
                                if (latediff > timePleaseLate) {
                                    shiftLate = 1;
                                    shiftLateTime = latediff
                                }
                            }
    
    
                        }
    
                        if (data.userId == 'lOE0jMgJYyRvoE2r2f0p') {
                            console.log('CountNotWork นับวันขาด', CountNotWork);
                        }
    
    
                        //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                        if (jobHave == true) {
                            //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                            if (jobLateTime > timePleaseLate) {
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(jobLateTime)
                            }
    
                            if (shiftHave == true) { //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                                SumShiftDay += 1;
                                SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                            }
    
                        } else if (shiftHave == true) {
                            //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                            SumShiftDay += 1;
                            SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                            //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                            if (shiftLateTime > timePleaseLate) {
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(shiftLateTime)
                            }
                        } else { //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                            //กรณีมีสาย
                            if (finded.LateCount != undefined) {
                                if(Number(finded.LateTimeMinite) > timePleaseLate){
                                    lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                    CountLate += 1
                                    _tmpCheckLate = true
                                    SumLateTime += Number(finded.LateTimeMinite)
                                }
                            }
                        }
    
    
    
                        console.log('==>SumLateTime', SumLateTime, jobHave);
                        //นับวันทำงาน
                        CountDateCheckIn++
                        checkInShow = moment(finded.CheckInTime.toDate()).format('เข้า HH:mm ')
    
                    }
    
                    if (findedCheckOut != undefined) {
                        //กรณีมีเช็คอิน
                        checkInShow =
                            checkInShow +
                            moment(findedCheckOut.CheckOutTime.toDate()).format(
                                ' - ออก HH:mm'
                            )
                    }
    
                    //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                    var _tmpThisWeekend = false
                    if (
                        _docStandardProfile.Weeked.Mon == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Mon'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Tue == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Tue'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Wed == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Wed'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Thu == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Thu'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Fri == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Fri'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Sat == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Sat'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
                    if (
                        _docStandardProfile.Weeked.Sun == 1 &&
                        moment(currentMomentPeruser).locale('en').format('ddd') ==
                        'Sun'
                    ) {
                        _tmpThisWeekend = true
                        CountDateWeekend++
                    }
    
                    //เช็คว่าเป็นวันหยุดพิเศษไหม
                    var _findedHolidaData = holidayData.Holiday.find(
                        (ele) =>
                            ele == moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                    )
    
                    //คำนวนโอที
                    if (overTimeDoc.length > 0) {
                        var findedOverTime = overTimeDoc.find(ele => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        var filterDataOT = overTimeDoc.filter((ele) => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ==
                            moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                        )

                        if (filterDataOT.length > 0) {
                            var sumHoursOT = 0
                            var sumMinutesOT = 0
                            for (let indexOT = 0; indexOT < filterDataOT.length; indexOT++) {
                                var itemOT = filterDataOT[indexOT];
                                sumHoursOT += itemOT.sumHours
                                sumMinutesOT += itemOT.sumMinutes
                            }

                            var sumAllOT = Number(sumHoursOT + '.' + sumMinutesOT)
                            var _otType = 'โอทีวันทำงานปกติ';
                            if (_findedHolidaData != undefined) {
                                _otType = 'โอทีวันหยุดพิเศษ';
                            } else if (_tmpThisWeekend == true) {
                                _otType = "โอทีวันหยุดประจำสัปดาห์";
                            }

                            if(shiftHave == true){
                                _otType = 'โอทีวันทำงานปกติ';
                            }

                            var _obj = {
                                salary: salary,
                                otHour: sumAllOT,
                                otType: _otType,
                                empType: employeeTypeId, //พนักงานรายวัน
                            }
                            console.log('==>__obj', _obj);
                            var _money = await calOTIncome(_docStandardProfile, _obj)
                            SumOTHour += Number(sumAllOT)
                            SalaryOT += Number(_money)
                        }
    
                    }
    
                    //เช็คว่าลาหรือไม่
                    var findedLeave = leaveDoc.find(
                        (ele) =>
                            moment(currentMomentPeruser).isBetween(moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD'), moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')) ||
                            moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ||
                            moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                    )
    
                    if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                        console.log('มีการลาในวันนี้', findedLeave);
                    }
    
                    // console.log('findedLeave',findedLeave);
                    if (findedLeave != undefined) {
                        
                        CountLeave++
    
                        //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                        if (finded != undefined) {
                            CountDateCheckIn--
                            var _diffLeave = timediff(
                                findedLeave.StartDateTime.toDate(),
                                findedLeave.EndDateTime.toDate(),
                                'Hm'
                            )
                            var _tmpLeaveHour = ''
                            if (_diffLeave.hours < 9) {
                                _tmpLeaveHour =
                                    '' +
                                    _diffLeave.hours +
                                    '.' +
                                    _diffLeave.minutes +
                                    ' ชม.' +
                                    '\n'
                            }
    
                            if (_tmpCheckLate == true) {
                                //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                                if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                                    console.log('ก่อนตัด', SumLateTime, CountLate, finded.LateTimeMinite);
                                }
    
                                CountLate--
                                SumLateTime -= Number(finded.LateTimeMinite)
    
                                if (userId == 'OU3VqWGVhLuG9CsEUxgh') {
                                    console.log('หลังตัด', SumLateTime, CountLate);
                                }
    
    
                            }
                        }
    
                        if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '1') {
                            // var getLeave = 
                            // console.log('ค่าแรงในวันลา');
                            CountDateCheckIn++
                        } else if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '0' || _docStandardProfile.UseLeaveMoney == undefined) {
                            console.log('ไม่ได้ค่าแรงในวันลา');
                        }
                    } else {
                        //ถ้าไม่ใช่ลา
                        if (_tmpThisWeekend == false && checkInShow == '-') {
    
                            if (_findedHolidaData != undefined) {
                                //ถ้าเป็นวันหยุดพิเศษ ไม่นับว่าขาดงาน
                                if (checkInShow != '-') { //ถ้ามีมาทำงานวันหยุดพิเศษให้นับวันจำนวนวันหยุดพิเศษ
                                    CountHoliday++
                                }
                            } else {
                                //ถ้าเป็นวันทำงานปกติ ให้นับว่าขาด
                                if(checkInShow == '-'){
                                    CountDayla = true
                                    CountNotWork++
                                }
                            }
    
                        }
                    }
    
                    if (finded == undefined && _findedHolidaData == undefined) {
                        //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่ 
                        var findedShitf2 = employeeShitfDoc.find(ele => ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD'));
    
                        if (findedShitf2 != undefined && findedLeave == undefined) { //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                            if(CountDayla != true){
                                CountNotWork++
                            }
                        }
                    }
    
    
                    //ถ้ามีเช็คอินในวันหยุด หรือวันหยุดพิเศษ ให้นับวันทำงานด้วย
                    if (finded != undefined) {
                        if (_findedHolidaData != undefined) {
                            //ถ้าวันนี้มาทำงานในวันหยุดพิเศษ จะนับวันทำงานด้วยเพื่อเอาไปคิดเงิน
                            CountHolidayWork++;
                        } else if (_tmpThisWeekend) {
                            var _findedHaveShitf = employeeShitfDoc.find(
                                (ele) =>
                                    ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                            )
                            if (_findedHaveShitf == undefined) {
                                //ต้องไม่เป็นกะ ถึงจะถือว่าเป็นการทำงานวันหยุดประจำสัปดาห์
                                //วันนี้เป็นวันหยุดประจำสัปดาห์
                                CountWeekendWork++;
                            }
    
                        }
                    }
    
    
    
                    currentMomentPeruser.add(1, 'days')
                }

                

                CountWorking = CountDateCheckIn

                


            //////////////////////////////////////////////////////////////

            console.log('ผลรายรับ แจง Payroll', dataForSavePayRoll.IncomeMoneyTextList);
            console.log('ผลรายจ่าย แจง Payroll', dataForSavePayRoll.ExpenseMoneyTextList);

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )

            var resM33 = 0

            if (_docStandardProfile.UseCutM33 != undefined) {
                if (_docStandardProfile.UseCutM33 == 1) {
                    var dataCalM33 = {
                        salary: salary,
                        percent: Number(_docStandardProfile.M33Rate),
                    }
                    resM33 = calM33(dataCalM33)
                    console.log('หลังคำนวณ M33 เสร็จ => ', resM33);

                    dataForSavePayRoll.ExpenseHintTextList[2] = 'ประกันสังคม ' + numeral(Number(resM33)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.ExpenseMoneyTextList[2] = '' + numeral(Number(resM33)).format('0.00');
                }
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            // //---------------------คำนวณภาษีแบบใหม่--------------------//
            // var newTax = {
            //     vatCutPercent: 0.0,
            //     taxAllYear: 0.0,
            //     taxPerMonth: 0.0,
            // }
            // if(docUser.TawitUse == 1){
                
            //     newTax = await calTax({
            //         compId: compId,
            //         salary: income,
            //         moneyPay: 100000,
            //         deduc: 60000,
            //         m33: resM33 * 12,
            //     })

            //     console.log('คำนวนภาษี ---> OXOXOXOX', newTax);
            //     // console.log('newTax -> ', newTax);
            //     dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(newTax.taxPerMonth)).format('0,0.00') + ' บาท';
            //     dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(newTax.taxPerMonth)).format('0.00');

            //     if(Number(newTax.taxPerMonth) > 0){
            //         expense += Number(newTax.taxPerMonth)
            //     }
            // }
            // //---------------------คำนวณภาษีแบบใหม่--------------------//

            netmoney = Number(Number(income - expense).toFixed(2))
        } else {
            //ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้
            console.log('ถ้าไม่มีข้อมูลเงินเดือนที่ทำไว้')
            //ข้อมูลวันหยุดประจำปี
            var holidayData = {}
            if (moment(startDate).format('YYYY') == moment(endDate).format('YYYY')) {
                //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
                var _tmpHoliday = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData = _tmpHoliday.data()
            } else {
                //กรณีดึงข้อมูลข้ามปี
                var _tmpHolidayStart = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                var _tmpHolidayEnd = await db
                    .collection(compId + 'CompanyHoliday')
                    .doc(moment(startDate).format('YYYY'))
                    .get()
                holidayData['Holiday'] = _tmpHolidayStart
                    .data()
                    .Holiday.concat(_tmpHolidayEnd.Holiday)
                holidayData['HolidayName'] = _tmpHolidayStart
                    .data()
                    .HolidayName.concat(_tmpHolidayEnd.HolidayName)
            }

            //นับวันที่ทำงาน ขาด ลา มาสาย
            const currentMomentPeruser = moment(startDate).locale('th')
            const endMomentPeruser = moment(endDate).locale('th').add(1, 'day')
            const checkIn = await getCheckIn(
                userId,
                compId,
                _docStandardProfile,
                startDate,
                endDate
            )
            const checkOut = await getCheckOut(userId, compId, startDate, endDate)
            const leaveDoc = await getLeave(userId, compId, startDate, endDate)
            const lateDoc = await getLate(userId, compId, startDate, endDate)

            //ดึงข้อมูล OT
            const overTimeDoc = await getOverTime(userId, compId, startDate, endDate)
            console.log('overTimeDoc', overTimeDoc)

            //ดึงข้อมูลกะ
            console.log('userId', userId)
            const employeeShitfDoc = await getEmployeeShitf(
                userId,
                compId,
                startDate,
                endDate
            )
            console.log('employeeShitfDoc', employeeShitfDoc)

            //ดึงข้อมูล ประกาศงาน
            const jobDoc = await getJob(userId, compId, startDate, endDate)
            console.log('jobDoc', jobDoc)

            var CountDateCheckIn = 0 //นับวันทำงาน
            var CountLate = 0 //นับครั้งมาสาย
            var SumLateTime = 0 //นับนาทีมาสาย
            var CountDateWeekend = 0 //นับวันหยุดประจำสัปดาห์
            var CountLeave = 0 //นับวันลา
            var CountNotWork = 0 //นับวันขาดงาน
            var CountHoliday = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var CountWeekendWork = 0 //นับวันทำงานที่เป็นวันหยุดประจำสัปดาห์
            var CountHolidayWork = 0 //นับวันทำงานที่เป็นวันหยุดพิเศษ
            var SumMoneyWeekend = 0 //รวมเงินที่ทำงานวันหยุดประจำสัปดาห์
            var SumMoneyHoliday = 0 //รวมเงินที่ทำงานวันหยุดพิเศษ
            var SumDayNoMoney = 0 //รวมเงินลาประเภทที่ไม่ได้รับเงิน
            var arrLeave = [] //เก็บข้อมูลประเภทการลาที่ไม่ได้รับเงิน

            //วนนับวันทำงาน
            while (currentMomentPeruser.isBefore(endMomentPeruser, 'day')) {
                var CountDayla = false  ////ตัวแปรเช็ควันลา

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//
                var timePleaseLate = 0
                var findLate = lateDoc.find((ele) => moment.tz(ele.DateTimeLate.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') == moment(currentMomentPeruser).format('YYYY-MM-DD'))

                if(findLate != undefined){
                    var timeLateUser = moment.tz(findLate.DateTimeLate.toDate(), 'Asia/Bangkok').format('HH:mm')
                    var timeCheckInProfile = moment('2022-01-01 ' + _docStandardProfile.TimeIn).toDate()
                    var timeCheckInLate = moment('2022-01-01 ' + timeLateUser).toDate()

                    var diffLate = timediff(timeCheckInProfile, timeCheckInLate)
                    // console.warn('diffLate -> ', diffLate);
                    timePleaseLate = (diffLate.hours * 60) + diffLate.minutes
                }

                timePleaseLate = Number(timePleaseLate) + Number(profileTimeLate)

                //---------------------ถ้าขอสายแล้วจะไม่โดนหักสาย-------------------//

                var _tmpCheckLate = false
                var checkInShow = '-'
                //หาเช็คอินแรกสุด
                var finded = checkIn.find(
                    (ele) =>
                        moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //หาเข็คเอ้าสุดท้าย เรียงเอ้าสุดท้ายจาก getCheckOut แล้ว
                var findedCheckOut = checkOut.find(
                    (ele) =>
                        moment(ele.CheckOutTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).format('YYYY-MM-DD')
                )

                //ถ้ามีการเช็คอิน

                if (finded != undefined) {
                    //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                    var jobHave = false //พนักงานมีเข้างานในการประกาศงานหรือไม่
                    var jobLate = 0 //พนักงานเข้าสาย
                    var jobLateTime = 0 //พนักงานเข้าสายนาที
                    if (jobDoc.length > 0) {
                        //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                        var findedJob = jobDoc.find(
                            (ele) =>
                                ele.StartDate ==
                                moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                        // console.log('-->findedJob', findedJob);
                        if (findedJob != undefined) {
                            jobHave = true
                            var latediff = moment
                                .tz(finded.CheckInTime.toDate(), 'Asia/Bangkok')
                                .diff(
                                    moment.tz(
                                        findedJob.StartDate + ' ' + findedJob.StartTime,
                                        'Asia/Bangkok'
                                    ),
                                    'minutes'
                                )

                            finded['LateTimeMinite'] = latediff
                            // console.log('-->latediff', latediff);
                            if (latediff > timePleaseLate) {
                                jobLate = 1
                                jobLateTime = latediff
                            }
                        }
                    }

                    //ตรวจสอบว่าวันนี้มี กะหรือไม่
                    var shiftHave = false //พนักงานมีเข้างานในกะหรือไม่
                    var shiftLate = 0 //พนักงานเข้ากะแล้วสายครั้ง
                    var shiftLateTime = 0 //พนักงานเข้ากะสายนาที
                    if (employeeShitfDoc.length > 0) {
                        var findedShitf = employeeShitfDoc.find(
                            (ele) =>
                                ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        if (findedShitf != undefined) {
                            shiftHave = true
                            var latediff = moment
                                .tz(finded.CheckInTime.toDate(), 'Asia/Bangkok')
                                .diff(
                                    moment.tz(
                                        findedShitf.Day +
                                        ' ' +
                                        findedShitf.ShiftDetail.StartWorkingTime,
                                        'Asia/Bangkok'
                                    ),
                                    'minutes'
                                )
                            finded['LateTimeMinite'] = latediff
                            console.log('-->latediff', latediff)
                            if (latediff > timePleaseLate) {
                                shiftLate = 1
                                shiftLateTime = latediff
                            }
                        }
                    }

                    //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                    if (jobHave) {
                        //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (jobLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(jobLateTime)
                        }
                        if (shiftHave == true) {
                            //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                            SumShiftDay += 1
                            SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value)
                        }
                    } else if (shiftHave == true) {
                        //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                        SumShiftDay += 1
                        SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value)
                        //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                        if (shiftLateTime > timePleaseLate) {
                            CountLate += 1
                            _tmpCheckLate = true
                            SumLateTime += Number(shiftLateTime)
                        }
                    } else {
                        //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                        //กรณีมีสาย
                        if (finded.LateCount != undefined) {
                            if(Number(finded.LateTimeMinite) > timePleaseLate){
                                lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                CountLate += 1
                                _tmpCheckLate = true
                                SumLateTime += Number(finded.LateTimeMinite)
                            }
                        }
                    }
                    //นับวันทำงาน
                    CountDateCheckIn++
                    checkInShow = moment(finded.CheckInTime.toDate()).format(
                        'เข้า HH:mm '
                    )
                }

                if (findedCheckOut != undefined) {
                    //กรณีมีเช็คอิน
                    checkInShow =
                        checkInShow +
                        moment(findedCheckOut.CheckOutTime.toDate()).format(' - ออก HH:mm')
                }

                //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                var _tmpThisWeekend = false
                if (
                    _docStandardProfile.Weeked.Mon == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Mon'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Tue == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Tue'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Wed == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Wed'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Thu == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Thu'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Fri == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Fri'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sat == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Sat'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }
                if (
                    _docStandardProfile.Weeked.Sun == 1 &&
                    moment(currentMomentPeruser).locale('en').format('ddd') == 'Sun'
                ) {
                    _tmpThisWeekend = true
                    CountDateWeekend++
                }

                //เช็คว่าเป็นวันหยุดพิเศษไหม
                var _findedHolidaData = holidayData.Holiday.find(
                    (ele) =>
                        ele ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                )

                //คำนวนโอที
                if (overTimeDoc.length > 0) {
                    var findedOverTime = overTimeDoc.find(
                        (ele) =>
                            moment
                                .tz(ele.StartDateTime.toDate(), 'Asia/Bangkok')
                                .format('YYYY-MM-DD') ==
                            moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )
                    var filterDataOT = overTimeDoc.filter((ele) => moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ==
                        moment(currentMomentPeruser).locale('en').format('YYYY-MM-DD')
                    )

                    if (filterDataOT.length > 0) {

                        var sumHoursOT = 0
                        var sumMinutesOT = 0
                        for (let indexOT = 0; indexOT < filterDataOT.length; indexOT++) {
                            var itemOT = filterDataOT[indexOT];
                            sumHoursOT += itemOT.sumHours
                            sumMinutesOT += itemOT.sumMinutes
                        }

                        var sumAllOT = Number(sumHoursOT + '.' + sumMinutesOT)

                        var _otType = 'โอทีวันทำงานปกติ'
                        if (_findedHolidaData != undefined) {
                            _otType = 'โอทีวันหยุดพิเศษ'
                        } else if (_tmpThisWeekend == true) {
                            _otType = 'โอทีวันหยุดประจำสัปดาห์'
                        }

                        if(shiftHave == true){
                            _otType = 'โอทีวันทำงานปกติ';
                        }

                        var _obj = {
                            salary: salary,
                            otHour: sumAllOT,
                            otType: _otType,
                            empType: employeeTypeId, //พนักงานรายวัน
                        }
                        console.log('==>__obj', _obj)
                        var _money = await calOTIncome(_docStandardProfile, _obj)
                        console.log('==>_money', _money)
                        SumOTHour += Number(sumAllOT)
                        SalaryOT += Number(_money)
                    }
                }

                //เช็คว่าลาหรือไม่
                var findedLeave = leaveDoc.find(
                    (ele) => moment(currentMomentPeruser).isBetween(moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD'), moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.StartDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD') ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') == moment.tz(ele.EndDateTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                )

                // console.log('findedLeave',findedLeave);
                if (findedLeave != undefined) {
                    if (findedLeave.LeaveTypeData.Wages == 'ไม่ได้รับค่าจ้าง') {
                        var findArrLeave = arrLeave.findIndex((ele) => ele.LeaveID == findedLeave.LeaveID)
                        if (findArrLeave == -1) {
                            var cutLeaveDay = 0
                            var cutLeaveHours = 0
                            var cutLeaveMinutes = 0

                            if (findedLeave.Cut_Day > 0) {
                                cutLeaveDay = (salary / 30) * findedLeave.Cut_Day
                                
                            }

                            if (findedLeave.Cut_Hours > 0) {
                            var LeaveHours = (salary / 30)
                            cutLeaveHours = LeaveHours / 9 * findedLeave.Cut_Hours
                            }
                            if (findedLeave.Cut_Minutes > 0) {
                                var LeaveMinutes = (salary / 30)
                                var _LeaveMinutes = LeaveMinutes / 9
                                cutLeaveMinutes = _LeaveMinutes / 2
                            }

                            arrLeave.push(findedLeave)

                            var sumUnpaid = cutLeaveDay + cutLeaveHours + cutLeaveMinutes
                            
                            SumDayNoMoney += sumUnpaid
                            console.log('วันลาที่ไม่ได้เงิน else', SumDayNoMoney);
                        }
                        
                    }
                    CountLeave++

                    //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                    if (finded != undefined) {
                        CountDateCheckIn--
                        var _diffLeave = timediff(
                            findedLeave.StartDateTime.toDate(),
                            findedLeave.EndDateTime.toDate(),
                            'Hm'
                        )
                        var _tmpLeaveHour = ''
                        if (_diffLeave.hours < 9) {
                            _tmpLeaveHour =
                                '' + _diffLeave.hours + '.' + _diffLeave.minutes + ' ชม.' + '\n'
                        }

                        if (_tmpCheckLate == true) {
                            //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                            CountLate--
                            SumLateTime -= Number(finded.LateTimeMinite)
                        }
                    }

                    if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '1') {
                        // var getLeave = 
                        // console.log('ค่าแรงในวันลา');
                        CountDateCheckIn++
                    } else if (docUser.EmployeeTypeName == 'พนักงานรายวัน' && docUser.EmployeeTypeID == '2' && _docStandardProfile.UseLeaveMoney == '0' || _docStandardProfile.UseLeaveMoney == undefined) {
                        console.log('ไม่ได้ค่าแรงในวันลา');
                    }
                } else {
                    //ถ้าไม่ใช่ลา
                    if (_tmpThisWeekend == false && checkInShow == '-') {
                        if (_findedHolidaData != undefined) {
                            //ถ้าเป็นวันหยุดพิเศษ ไม่นับว่าขาดงาน
                            if (checkInShow != '-') {
                                //ถ้ามีมาทำงานวันหยุดพิเศษให้นับวันจำนวนวันหยุดพิเศษ
                                CountHoliday++
                            }
                        } else {
                            //ถ้าเป็นวันทำงานปกติ ให้นับว่าขาด
                            if(checkInShow == '-'){
                                CountDayla = true
                                CountNotWork++
                            }
                        }
                    }
                }

                if (finded == undefined && _findedHolidaData == undefined) {
                    //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่
                    var findedShitf2 = employeeShitfDoc.find(
                        (ele) =>
                            ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )

                    if (findedShitf2 != undefined && findedLeave == undefined) {
                        //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                        if(CountDayla != true){
                            CountNotWork++
                        }
                    }
                }

                //ถ้ามีเช็คอินในวันหยุด หรือวันหยุดพิเศษ ให้นับวันทำงานด้วย
                if (finded != undefined) {
                    if (_findedHolidaData != undefined) {
                        //ถ้าวันนี้มาทำงานในวันหยุดพิเศษ จะนับวันทำงานด้วยเพื่อเอาไปคิดเงิน
                        CountHolidayWork++;
                    } else if (_tmpThisWeekend) {
                        var _findedHaveShitf = employeeShitfDoc.find(
                            (ele) =>
                                ele.Day == moment(currentMomentPeruser).format('YYYY-MM-DD')
                        )
                        if (_findedHaveShitf == undefined) {
                            //ต้องไม่เป็นกะ ถึงจะถือว่าเป็นการทำงานวันหยุดประจำสัปดาห์
                            //วันนี้เป็นวันหยุดประจำสัปดาห์
                            CountWeekendWork++;
                        }

                    }
                }

                currentMomentPeruser.add(1, 'days')
            }

            CountWorking = CountDateCheckIn

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดประจำสัปดาห์หรือไม่
            if (_docStandardProfile.UsePayMoneyWeekend == '1') {
                var _typePayWeekend = _docStandardProfile.UsePayMoneyWeekendTypeID;
                if (_typePayWeekend == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyWeekend =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyWeekend =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyWeekend =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerTimes) *
                            Number(CountWeekendWork)
                    }
                } else if (_typePayWeekend == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyWeekend = Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayWeekend == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyWeekend =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyWeekendTypeIDPerHourBaht) *
                        Number(CountWeekendWork)
                }
            }

            //เช็คว่ามีรายได้กรณีมาทำงานวันหยุดพิเศษหรือไม่
            if (_docStandardProfile.UsePayMoneyHoliday == '1') {
                var _typePayHoliday = _docStandardProfile.UsePayMoneyHolidayTypeID;
                if (_typePayHoliday == '1') {
                    if (employeeTypeId == '1') {
                        //พนักงานรายเดือน
                        SumMoneyHoliday =
                            (salary / 30) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '2') {
                        //พนักงานรายวัน  สูตร. (ค่าจ้างต่อวัน) × จำนวนเท่า * วันทำงาน
                        SumMoneyHoliday =
                            (salary) *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    } else if (employeeTypeId == '3') {
                        SumMoneyHoliday =
                            salary *
                            Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerTimes) *
                            Number(CountHolidayWork)
                    }
                } else if (_typePayHoliday == '2') {
                    //คิดแบบเหมาเป็นวัน
                    SumMoneyHoliday = Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerBaht) * Number(CountWeekendWork)
                } else if (_typePayHoliday == '3') {
                    //คิดแบบจ่ายเป็นชั่วโมง ชั่วโมงละ xx บาท ฟิก 8 ชม ต่อวัน
                    SumMoneyHoliday =
                        8 *
                        Number(_docStandardProfile.UsePayMoneyHolidayTypeIDPerHourBaht) *
                        Number(CountHolidayWork)
                }
            }


            //คำนวนเงินเดือน
            if (employeeTypeId == 2) {
                //พนักงานรายวัน
                salary = salary * CountDateCheckIn
            } else {
                //พนักงานรายเดือน
                salary = salary
            }

            //คิดเงินประกันสังคม ถ้าไม่ติ๊กใช้งานคือไม่คิดเงินประกันสังคม
            var resM33 = 0
            if (_docStandardProfile.UseCutM33 != undefined) {
                if (_docStandardProfile.UseCutM33 == 1) {
                    var dataCalM33 = {
                        salary: salary,
                        percent: Number(_docStandardProfile.M33Rate),
                    }
                    resM33 = calM33(dataCalM33)
                }
            }

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('CountNotWork -> ', CountNotWork)
            }

            var resAbsent = 0

            if (
                docUser.EmployeeTypeID == 1 ||
                docUser.EmployeeTypeName == 'พนักงานประจำ'
            ) {
                resAbsent = await calAbsent(
                    CountNotWork,
                    compId,
                    userId,
                    profileId,
                    salary,
                    SumLateTime
                )
            }

            var tax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }

            //-------------คำนวณภาษีแบบเก่า----------------//
            // if (docUser.TawitUse == 1) {
            //     //ถ้าคิดภาษีเงินได้บุคคลธรรมดา
            //     tax = await calTax({
            //         salary: salary,
            //         moneyPay: 100000,
            //         deduc: 60000,
            //         m33: resM33 * 12,
            //     })
            // }
            //-------------คำนวณภาษีแบบเก่า----------------//

            //------------------วันลาที่ไม่ได้เงิน--------------------//
            console.log('รวม else', SumDayNoMoney);
            if (SumDayNoMoney > 0) {
                resAbsent += Number(SumDayNoMoney) + Number(resAbsent)
                console.log('5555 else', resAbsent);
            }
            
            //------------------วันลาที่ไม่ได้เงิน--------------------//

            dataForSavePayRoll = {
                ExpenseHintTextList: [
                    'ภาษี ' + numeral(tax.taxPerMonth).format('0,0.00') + ' บาท',
                    'WHT 0.00 บาท',
                    'ประกันสังคม ' + numeral(resM33).format('0,0.00') + ' บาท',
                    'สายขาดลา ' + numeral(resAbsent).format('0,0.00') + ' บาท',
                    'หักอื่นๆ 0.00 บาท',
                    'รายได้รับล่วงหน้า 0.00 บาท',
                ],
                ExpenseMoneyTextList: [
                    '' + tax.taxPerMonth,
                    '0.00',
                    '' + resM33,
                    '' + resAbsent,
                    '0.00',
                    '0.00',
                ],
                ExpenseNameTextList: [
                    'ภาษี',
                    'WHT',
                    'ประกันสังคม',
                    'สายขาดลา',
                    'หักอื่นๆ',
                    'รายได้รับล่วงหน้า',
                ],
                IncomeHintTextList: [
                    'เงินเดือน ' + numeral(salary).format('0,0.00') + ' บาท',
                    'เบี้ยขยัน 0.00 บาท',
                    'โอที 0.00 บาท',
                    'คอมมิชชั่น 0.00 บาท',
                    'โบนัส 0.00 บาท',
                    'รายได้อื่นๆ 0.00 บาท',
                ],
                IncomeMoneyTextList: [
                    '' + salary,
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                    '0.00',
                ],
                IncomeNameList: [
                    'เงินเดือน',
                    'เบี้ยขยัน',
                    'โอที',
                    'คอมมิชชั่น',
                    'โบนัส',
                    'รายได้อื่นๆ',
                ],
                OtherHintTextList: [
                    'รายได้สะสม 0.00 บาท',
                    'ภาษีสะสม 0.00 บาท',
                    'WHT สะสม 0.00 บาท',
                    'ประกันสังคมสะสม 0.00 บาท',
                ],
                OtherMoneyTextList: ['0.00', '0.00', '0.00', '0.00'],
                OtherNameTextList: [
                    'รายได้สะสม',
                    'ภาษีสะสม',
                    'WHT สะสม',
                    'ประกันสังคมสะสม',
                ],
                SetUserId: userId,
            }

            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////

            if(listExtraMoney.ExpenseHintTextList.length > 0){
                dataForSavePayRoll['ExpenseHintTextList'].push(...listExtraMoney.ExpenseHintTextList)
            }
            if(listExtraMoney.ExpenseMoneyTextList.length > 0){
                dataForSavePayRoll['ExpenseMoneyTextList'].push(...listExtraMoney.ExpenseMoneyTextList)
            }
            if(listExtraMoney.ExpenseNameTextList.length > 0){
                dataForSavePayRoll['ExpenseNameTextList'].push(...listExtraMoney.ExpenseNameTextList)
            }

            if(listExtraMoney.IncomeHintTextList.length > 0){
                dataForSavePayRoll['IncomeHintTextList'].push(...listExtraMoney.IncomeHintTextList)
            }
            if(listExtraMoney.IncomeMoneyTextList.length > 0){
                dataForSavePayRoll['IncomeMoneyTextList'].push(...listExtraMoney.IncomeMoneyTextList)
            }
            if(listExtraMoney.IncomeNameList.length > 0){
                dataForSavePayRoll['IncomeNameList'].push(...listExtraMoney.IncomeNameList)
            }
            ///กรณีมีเพิ่มเงินพิเศษทิ้งไว้ ก่อนทำเงินเดือน////

            if (userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('resAbsent -> ', resAbsent)
            }

            if (SalaryOT > 0 && SumOTHour > 0) {
                dataForSavePayRoll.IncomeHintTextList[2] =
                    'โอที ' + numeral(Number(SalaryOT)).format('0,0.00') + ' บาท'
                dataForSavePayRoll.IncomeMoneyTextList[2] =
                    '' + numeral(Number(SalaryOT)).format('0.00')
            }

            if (data.userId == 'brZVFEXwSOmgAJMe9Hos') {
                console.log('datadatadata/////ฟฟฟฟฟฟฟฟ', salary)
            }

            // income = salary;
            // expense = Number(tax.taxPerMonth) + Number(resM33);

            if (addMoneyExtra != undefined) {
                //ถ้ามีสั่งเพิ่มเงินพิเศษ
                dataForSavePayRoll.IncomeHintTextList.push(
                    addMoneyExtra.Name +
                    ' ' +
                    numeral(Number(addMoneyExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.IncomeMoneyTextList.push(
                    numeral(Number(addMoneyExtra.Money)).format('0.00')
                )
                dataForSavePayRoll.IncomeNameList.push(addMoneyExtra.Name)
            }

            if (addExpenseExtra != undefined) {
                //ถ้ามีสั่งหักเงินพิเศษ
                dataForSavePayRoll.ExpenseHintTextList.push(
                    addExpenseExtra.Name +
                    ' ' +
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00') +
                    ' บาท'
                )
                dataForSavePayRoll.ExpenseMoneyTextList.push(
                    numeral(Number(addExpenseExtra.Money)).format('0,0.00')
                )
                dataForSavePayRoll.ExpenseNameTextList.push(addExpenseExtra.Name)
            }

            //เช็กเพื่อเติมเบี้ยขยันก่อน
            //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
            console.log('==>SalaryDiligent', SalaryDiligent)
            if (SalaryDiligent > 0) {
                dataForSavePayRoll.IncomeHintTextList[1] =
                    'เบี้ยขยัน ' +
                    numeral(Number(SalaryDiligent)).format('0,0.00') +
                    ' บาท'
                dataForSavePayRoll.IncomeMoneyTextList[1] =
                    '' + numeral(Number(SalaryDiligent)).format('0.00')
            }
            console.log('==>SalaryLiving', SalaryLiving)
            //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
            if (SalaryLiving > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่าครองชีพ'
                )
                console.log('==>finded', finded)
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าครองชีพ ' +
                        numeral(Number(SalaryLiving)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryLiving)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                } else {
                    //ถ้ามี
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่าครองชีพ ' +
                        numeral(Number(SalaryLiving)).format('0,0.00') +
                        ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryLiving)).format('0.00')
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                }
            }

            //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
            console.log('==>SalaryPosition', SalaryPosition)
            if (SalaryPosition > 0) {
                //เช็คก่อนว่ามีค่าตำแหน่งใส่มามั้ย
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่าตำแหน่ง'
                )
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าตำแหน่ง ' +
                        numeral(Number(SalaryPosition)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryPosition)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                } else {
                    //ถ้ามี
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่าตำแหน่ง ' +
                        numeral(Number(SalaryPosition)).format('0,0.00') +
                        ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryPosition)).format('0.00')
                }
            }

            //ถ้ามีรายได้ค่ากะ ให้เติมข้อมูลใน array
            if (SalaryShift > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(
                    (ele) => ele == 'ค่ากะ'
                )
                console.log('==>finded', finded)
                if (finded == -1) {
                    //ถ้าไม่มี
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SalaryShift)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่ากะ')
                } else {
                    //ถ้ามี
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                    dataForSavePayRoll.IncomeHintTextList[finded] =
                        'ค่ากะ ' + numeral(Number(SalaryShift)).format('0,0.00') + ' บาท'
                    dataForSavePayRoll.IncomeMoneyTextList[finded] =
                        '' + numeral(Number(SalaryShift)).format('0.00')
                    console.log(
                        '==>dataForSavePayRoll.IncomeHintTextList[finded]',
                        dataForSavePayRoll.IncomeHintTextList[finded]
                    )
                }
            }

            // หักเงินมาสาย
            if (CountLate > 0 && SumLateTime > 0) {
                //ถ้ากลุ่มนี้มีตั้งเงื่อนไขสายแล้วหักเงิน
                if (_docStandardProfile.UseTimeLateCutMoney == '1') {
                    if (SumLateTime > 0) {
                        var lateMinite = SumLateTime
                        var late = 1

                        //เช็คว่าใช้ เงื่อนไขหักเงินมาสายจากเบี้ยขยัน ค่าครองชีพ ค่าตำแหน่ง หรือไม่
                        if (_docStandardProfile.UseTimeLateCutMoneyExtra == '1') {
                            if (_docStandardProfile.chipExtraMoney != undefined) {
                                var moneyForCutLate = 0 //จำนวนเงินสำหรับตัด
                                if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                    //หักเป็นบาท ต่อ ชม.
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate =
                                        Number(_lateHour) *
                                        Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                } else if (
                                    _docStandardProfile.UseTimeLateCutMoneyTypeID == '2'
                                ) {
                                    //หักสูตรคิดเงินเดือน
                                    var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                    var _lateHour = (Number(late) * lateMinite) / 60
                                    moneyForCutLate = Number(_lateHour) * Number(_moneyPerDay)
                                }
                                //เอามาเช็คว่าใน array มีการเพิ่มค่าเบี้ยเลี้ยง ค่าครองชีพ ค่าตำแหน่ง เข้าไปใน array หรือยัง ถ้ายัง ให้เอาให้เพิ่มต่อกรณีที่มีการกำหนดจำนวนเงินมา
                                var checkHaveSalaryDiligent = false
                                var checkHaveSalaryLiving = false
                                var checkHaveSalaryPosition = false
                                if (moneyForCutLate > 0) {
                                    //ให้ทำการ วน ตัดจากลำดับที่เลือกไว้
                                    for (
                                        var ic = 0; ic < _docStandardProfile.chipExtraMoney.length; ic++
                                    ) {
                                        var chipExtra = _docStandardProfile.chipExtraMoney[ic]
                                        if (chipExtra == 'เบี้ยขยัน' && SalaryDiligent > 0) {
                                            console.log('chipExtra', chipExtra)
                                            //เบี้ยขยันลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryDiligent > moneyForCutLate) {
                                                checkHaveSalaryDiligent = true
                                                //ถ้าเบี้ยขยัน > เงินที่ตั้งตัด
                                                result = SalaryDiligent - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList[1] =
                                                    'เบี้ยขยัน ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                dataForSavePayRoll.IncomeMoneyTextList[1] =
                                                    '' + numeral(Number(result)).format('0.00')

                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                checkHaveSalaryDiligent = true
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                moneyForCutLate = moneyForCutLate - SalaryDiligent
                                                dataForSavePayRoll.IncomeHintTextList[1] =
                                                    'เบี้ยขยัน ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                dataForSavePayRoll.IncomeMoneyTextList[1] =
                                                    '' + numeral(Number(result)).format('0.00')
                                            }
                                        } else if (chipExtra == 'ค่าครองชีพ' && SalaryLiving > 0) {
                                            console.log('chipExtra', chipExtra)
                                            //ค่าครองชีพลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryLiving > moneyForCutLate) {
                                                checkHaveSalaryLiving = true
                                                //ถ้าค่าครองชีพ > เงินที่ตั้งตัด
                                                result = SalaryLiving - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าครองชีพ ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryLiving = true
                                                moneyForCutLate = moneyForCutLate - SalaryLiving
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าครองชีพ ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                            }
                                        } else if (
                                            chipExtra == 'ค่าตำแหน่ง' &&
                                            SalaryPosition > 0
                                        ) {
                                            console.log('chipExtra', chipExtra)
                                            //ค่าตำแหน่งลบเงินที่มาสาย
                                            var result = 0
                                            if (SalaryPosition > moneyForCutLate) {
                                                checkHaveSalaryPosition = true
                                                //ถ้าค่าตำแหน่ง > เงินที่ตั้งตัด
                                                result = SalaryPosition - moneyForCutLate
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าตำแหน่ง ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                                break //ตัดปกติจบ ตัดรอบเดียว
                                            } else {
                                                //ถ้าน้อยกว่า เอาไปตัดที่ค่าอื่นต่อไป
                                                checkHaveSalaryPosition = true
                                                moneyForCutLate = moneyForCutLate - SalaryPosition
                                                dataForSavePayRoll.IncomeHintTextList.push(
                                                    'ค่าตำแหน่ง ' +
                                                    numeral(Number(result)).format('0,0.00') +
                                                    ' บาท'
                                                )
                                                dataForSavePayRoll.IncomeMoneyTextList.push(
                                                    '' + numeral(Number(result)).format('0.00')
                                                )
                                                dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                            }
                                        } else if (chipExtra == 'เงินเดือน') {
                                            console.log('chipExtra', chipExtra)
                                            //เบี้ยขยันลบเงินที่มาสาย
                                            var result = 0
                                            result = salary - moneyForCutLate
                                            console.log(
                                                'result',
                                                numeral(Number(result)).format('0,0.00')
                                            )

                                            dataForSavePayRoll.IncomeHintTextList[0] =
                                                'เงินเดือน ' +
                                                numeral(Number(result)).format('0,0.00') +
                                                ' บาท'
                                            dataForSavePayRoll.IncomeMoneyTextList[0] = numeral(
                                                Number(result)
                                            )
                                                .format('0.00')
                                                .toString()
                                            console.log(
                                                'dataForSavePayRoll.IncomeMoneyTextList[0]',
                                                dataForSavePayRoll.IncomeMoneyTextList[0]
                                            )

                                            break //ตัดปกติจบ ตัดรอบเดียว
                                        }
                                    }
                                }

                                //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                                if (checkHaveSalaryDiligent == false && SalaryDiligent > 0) {
                                    dataForSavePayRoll.IncomeHintTextList[1] =
                                        'เบี้ยขยัน ' +
                                        numeral(Number(SalaryDiligent)).format('0,0.00') +
                                        ' บาท'
                                    dataForSavePayRoll.IncomeMoneyTextList[1] =
                                        '' + numeral(Number(SalaryDiligent)).format('0.00')
                                }

                                //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                                if (checkHaveSalaryLiving == false && SalaryLiving > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push(
                                        'ค่าครองชีพ ' +
                                        numeral(Number(SalaryLiving)).format('0,0.00') +
                                        ' บาท'
                                    )
                                    dataForSavePayRoll.IncomeMoneyTextList.push(
                                        '' + numeral(Number(SalaryLiving)).format('0.00')
                                    )
                                    dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                                }

                                //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                                if (checkHaveSalaryPosition == false && SalaryPosition > 0) {
                                    dataForSavePayRoll.IncomeHintTextList.push(
                                        'ค่าตำแหน่ง ' +
                                        numeral(Number(SalaryPosition)).format('0,0.00') +
                                        ' บาท'
                                    )
                                    dataForSavePayRoll.IncomeMoneyTextList.push(
                                        '' + numeral(Number(SalaryPosition)).format('0.00')
                                    )
                                    dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                                }
                            }
                        } else {
                            //ถ้าไม่ได้ตั้งหักตามลำดับ

                            if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '1') {
                                //หักเป็นบาท ต่อ ชม.
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney =
                                    Number(_lateHour) *
                                    Number(_docStandardProfile.UseTimeLateCutMoneyTypeIDPerBaht)
                                dataForSavePayRoll.ExpenseHintTextList[3] =
                                    'สายขาดลา ' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') +
                                    ' บาท'
                                dataForSavePayRoll.ExpenseMoneyTextList[3] =
                                    '' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0.00')
                            } else if (_docStandardProfile.UseTimeLateCutMoneyTypeID == '2') {
                                //หักสูตรคิดเงินเดือน
                                var _moneyPerDay = salary / 30 / 8 //ค่าแรงต่อชม
                                var _lateHour = (Number(late) * lateMinite) / 60
                                lateLeaveMoney = Number(_lateHour) * Number(_moneyPerDay)
                                dataForSavePayRoll.ExpenseHintTextList[3] =
                                    'สายขาดลา ' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0,0.00') +
                                    ' บาท'
                                dataForSavePayRoll.ExpenseMoneyTextList[3] =
                                    '' +
                                    numeral(Number(lateLeaveMoney + resAbsent)).format('0.00')
                            }
                        }
                    }
                } else {
                    //ถ้ามีกำหนดเบี้ยขยัน ให้เติมข้อมูลใน array
                    if (SalaryDiligent > 0) {
                        dataForSavePayRoll.IncomeHintTextList[1] =
                            'เบี้ยขยัน ' +
                            numeral(Number(SalaryDiligent)).format('0,0.00') +
                            ' บาท'
                        dataForSavePayRoll.IncomeMoneyTextList[1] =
                            '' + numeral(Number(SalaryDiligent)).format('0.00')
                    }

                    //ถ้ามีกำหนดค่าครองชีพ ให้เติมข้อมูลใน array
                    if (SalaryLiving > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push(
                            'ค่าครองชีพ ' +
                            numeral(Number(SalaryLiving)).format('0,0.00') +
                            ' บาท'
                        )
                        dataForSavePayRoll.IncomeMoneyTextList.push(
                            '' + numeral(Number(SalaryLiving)).format('0.00')
                        )
                        dataForSavePayRoll.IncomeNameList.push('ค่าครองชีพ')
                    }

                    //ถ้ามีกำหนดค่าตำแหน่ง ให้เติมข้อมูลใน array
                    if (SalaryPosition > 0) {
                        dataForSavePayRoll.IncomeHintTextList.push(
                            'ค่าตำแหน่ง ' +
                            numeral(Number(SalaryPosition)).format('0,0.00') +
                            ' บาท'
                        )
                        dataForSavePayRoll.IncomeMoneyTextList.push(
                            '' + numeral(Number(SalaryPosition)).format('0.00')
                        )
                        dataForSavePayRoll.IncomeNameList.push('ค่าตำแหน่ง')
                    }
                }
            }

            if (SumMoneyWeekend > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุด ' +
                        numeral(Number(SumMoneyWeekend)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyWeekend)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุด')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุด');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุด ' + numeral(Number(SumMoneyWeekend)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyWeekend)).format('0.00');
                }
            }

            if (SumMoneyHoliday > 0) {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded == -1) {
                    dataForSavePayRoll.IncomeHintTextList.push(
                        'ค่าทำงานวันหยุดพิเศษ ' +
                        numeral(Number(SumMoneyHoliday)).format('0,0.00') +
                        ' บาท'
                    )
                    dataForSavePayRoll.IncomeMoneyTextList.push(
                        '' + numeral(Number(SumMoneyHoliday)).format('0.00')
                    )
                    dataForSavePayRoll.IncomeNameList.push('ค่าทำงานวันหยุดพิเศษ')
                } else {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            } else {
                var finded = dataForSavePayRoll.IncomeNameList.findIndex(ele => ele == 'ค่าทำงานวันหยุดพิเศษ');
                if (finded >= 0) {
                    dataForSavePayRoll.IncomeHintTextList[finded] = 'ค่าทำงานวันหยุดพิเศษ ' + numeral(Number(SumMoneyHoliday)).format('0,0.00') + ' บาท';
                    dataForSavePayRoll.IncomeMoneyTextList[finded] = '' + numeral(Number(SumMoneyHoliday)).format('0.00');
                }
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            var listIncome = dataForSavePayRoll.IncomeMoneyTextList
            var listExpense = dataForSavePayRoll.ExpenseMoneyTextList

            for (let i = 0; i < listIncome.length; i++) {
                var checkComma = listIncome[i].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listIncome[i].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listIncome[i])
                }
                income += Number(money);
            }

            for (let e = 0; e < listExpense.length; e++) {
                const checkComma = listExpense[e].includes(',')
                var money = 0
                if(checkComma == true){
                    var arMoney = listExpense[e].replaceAll(',', '')
                    money = Number(arMoney)
                }else{
                    money = Number(listExpense[e])
                }
                expense += Number(money);
            }

            //---------- Jay 26/09/65 ดักลูกน้ำ -----------//

            //---------------------คำนวณภาษีแบบใหม่--------------------//
            var newTax = {
                vatCutPercent: 0.0,
                taxAllYear: 0.0,
                taxPerMonth: 0.0,
            }
            if(docUser.TawitUse == 1){
                newTax = await calTax({
                    compId: compId,
                    salary: income,
                    moneyPay: 100000,
                    deduc: 60000,
                    m33: resM33 * 12,
                })
                // console.log('newTax -> ', newTax);
                dataForSavePayRoll.ExpenseHintTextList[0] = 'ภาษี ' + numeral(Number(newTax.taxPerMonth)).format('0,0.00') + ' บาท';
                dataForSavePayRoll.ExpenseMoneyTextList[0] = '' + numeral(Number(newTax.taxPerMonth)).format('0.00');

                if(Number(newTax.taxPerMonth) > 0){
                    expense += Number(newTax.taxPerMonth)
                }
            }
            //---------------------คำนวณภาษีแบบใหม่--------------------//

            // income = dataForSavePayRoll.IncomeMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            // expense = dataForSavePayRoll.ExpenseMoneyTextList.reduce(
            //     (acc, cur) => Number(acc) + Number(cur)
            // )
            var RetainedIncome = 0
            var accumulatedTax = 0
            var cumulativeWHT = 0
            var socialSecurity = 0
            //คิวรี่ PayrollTransferSuccess เพื่อหารายได้สะสมของพนักงานแต่ละคน
            await db.collection(compId + 'PayrollTransferSuccess')
                .orderBy('Timestamp', "desc")
                .limit(1)
                .get()
                .then(async(querySnapshot) => {
                    console.log('xoxoxoxo if', querySnapshot.docs.length);
                    if (querySnapshot.docs.length > 0) {

                            var itemPayrollTransfer = querySnapshot.docs[0].data()
                            
                            var docTransfer = itemPayrollTransfer.Transfer.filter((ele) => ele.UserID == userId)
                            console.log('docTransfer-->>if', docTransfer);
                            if (docTransfer.length > 0) {
                                docTransfer.sort((a, b) => a.PayDate.localeCompare(b.PayDate))
                                //   console.log('>>>>>>', docTransfer);
                                var itemTransfer = docTransfer[docTransfer.length-1]
                                // console.log('>>>>>>>>>>>', itemTransfer);
                                /// split EndDate
                                var splitTimeStamp = itemTransfer.EndDate.split('-')
                                var arMonth = splitTimeStamp[1]
                                // var arYear = splitTimeStamp[0]
                                // var arDay = splitTimeStamp[2]

                                ///split PayDate
                                var split_payDate = itemTransfer.PayDate.split('-')
                                var arYearPayDate = split_payDate[0]
                                var arMonthPayDate = split_payDate[1]
                                var arDayPayDate = split_payDate[2]

                                var convert_payDate = moment(payDate).toDate()
                                var convertPayDate = moment(itemTransfer.PayDate).toDate()
                                // console.log('%%%%%%%%%', convert_payDate, convertPayDate);
                                // console.log('@@@@@@@@@', payDate, itemTransfer.PayDate);

                                if (payDate != itemTransfer.PayDate && convert_payDate > convertPayDate) {

                                    var dataPayDate = itemTransfer.UserID + '_' + arYearPayDate + arMonthPayDate + arDayPayDate
                                    // console.log('xoxoxoxo', dataPayDate);
                                    await db.collection(compId + 'Payroll')
                                    .doc(dataPayDate)
                                    .get()
                                    .then(async(queryPayroll) => {
                                        if (queryPayroll.data() != undefined ) {
                                            var item_Payroll = queryPayroll.data()
                                            var oSalary = item_Payroll.OtherMoneyTextList[0]
                                            // console.warn('AAA', oSalary);
                                            var oTax = item_Payroll.OtherMoneyTextList[1]
                                            // console.warn('BBB', oTax);
                                            var oWHT = item_Payroll.OtherMoneyTextList[2]
                                            // console.warn('CCC', oWHT);
                                            var oSocialMoney = item_Payroll.OtherMoneyTextList[3]
                                            // console.warn('DDD', oSocialMoney);
                                            // console.log('income', income);
                                            RetainedIncome = Number(oSalary) + income
                                            // console.log('รายได้สะสม', RetainedIncome);
                                            accumulatedTax = Number(oTax) + Number(dataForSavePayRoll.ExpenseMoneyTextList[0])
                                            // console.log('ภาษีสะสม', accumulatedTax);
                                            cumulativeWHT = Number(oWHT) + Number(dataForSavePayRoll.ExpenseMoneyTextList[1])
                                            // console.log('WHT สะสม', cumulativeWHT);
                                            socialSecurity = Number(oSocialMoney) + Number(dataForSavePayRoll.ExpenseMoneyTextList[2])

                                            // console.log('ประกันสังคมสะสม', socialSecurity);
                                            
                                            // console.log('======>', dataForSavePayRoll);
                                            var splitEndDate = endDate.split('-')
                                            var startMonth = splitEndDate[1]
                                            // console.log('&&&&&&', startMonth);

                                            if (startMonth == '01' && arMonth != '01') {
                                                // console.log('#######');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                                            }else{
                                                // console.log('*******');
                                                // รายได้สะสม
                                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(RetainedIncome)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(RetainedIncome)).format('0.00');

                                                // ภาษีสะสม
                                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(accumulatedTax)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(accumulatedTax)).format('0.00');

                                                // WHT สะสม
                                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(cumulativeWHT)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(cumulativeWHT)).format('0.00');

                                                // ประกันสังคมสะสม
                                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(socialSecurity)).format('0,0.00') + ' บาท';
                                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(socialSecurity)).format('0.00');
                                            }
                                        }
                                    })
                                }

                                
                            }else{
                                // console.log('1-------------------1--if');
                                // รายได้สะสม
                                dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                                // ภาษีสะสม
                                dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                                // WHT สะสม
                                dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                                // ประกันสังคมสะสม
                                dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                                dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                            }  
                    }else{
                        // console.log('2------------------2---if');
                        // รายได้สะสม
                        dataForSavePayRoll.OtherHintTextList[0] = 'รายได้สะสม ' + numeral(Number(income)).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[0] = '' + numeral(Number(income)).format('0.00');

                        // ภาษีสะสม
                        dataForSavePayRoll.OtherHintTextList[1] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[1] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[0])).format('0.00');

                        // WHT สะสม
                        dataForSavePayRoll.OtherHintTextList[2] = 'ภาษีสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[2] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[1])).format('0.00');

                        // ประกันสังคมสะสม
                        dataForSavePayRoll.OtherHintTextList[3] = 'ประกันสังคมสะสม ' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0,0.00') + ' บาท';
                        dataForSavePayRoll.OtherMoneyTextList[3] = '' + numeral(Number(dataForSavePayRoll.ExpenseMoneyTextList[2])).format('0.00');
                    }
                })

            netmoney = Number(Number(income - expense).toFixed(2))
        }

        // console.log('dataForSavePayRoll ก่อนอัพเดท', dataForSavePayRoll);

        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePay)
            .set(dataForSavePayRoll)

        //ใส่ข้อมูลเบิ้ลเพื่อเอาไปแสดงในแอพด้วย
        await db
            .collection(compId + 'Payroll')
            .doc(userId + '_' + _tmpDatePayMonthOnly)
            .set(dataForSavePayRoll)

        console.log('บันทึกข้อมูล');

        await db
            .collection(compId + 'User')
            .doc(userId)
            .update({ LateTime: CountLate })

        var result = {
            income: income,
            expense: expense,
            netmoney: netmoney,
            userId: userId,
            compId: compId,
            startDate: startDate,
            endDate: endDate,
            payDate: payDate,
            tmpDatePay: _tmpDatePay,
            CountNotWork: CountNotWork,
            countDateCheckIn: CountWorking,
        }

        return result
    } else {
        return 'no data send'
    }
})

exports.apiCalM33 = functions.https.onCall(async (data, context) => {
    if (data != undefined) {
        const salary = data.salary //เงินเดือน
        const percent =
            data.percent == undefined || data.percent == null ? 5 : data.percent //หักประกันสังคม %
        const maxBaht = data.maxBaht //ล็อกให้สูงสุดต้องจ่ายเป็นจำนวนบาท
        var result = 0.0
        //คิด ม33 ต้องปัดเศษถ้าเกิน .50 ให้ปัดเป็น 1 บาท ถ้าต่ำกว่า .50 ให้ปัดทิ้ง
        if (salary >= 1650.0 && salary < 15000.0) {
            result = Math.round(salary * (percent / 100))
        } else if (salary >= 15000.0) {
            result = Math.round((15000.0 * percent) / 100)
        }
        return Number(result.toFixed(2))
    } else {
        return 'no data send'
    }
})

//// 1
// exports.addExpenseExtra = functions.https.onCall(async (data, context) => {
exports.addExpenseExtra = functions.pubsub.schedule("*/5 * * * *").timeZone('Asia/Bangkok').onRun( async(context) => {

    var now = moment.tz('Asia/Bangkok')
    var now_date = now.format('YYYY-MM-DD')
    var now_time = now.format('HH:mm:ss')
    var nowDate = moment(now_date + ' ' + now_time).toDate()

    var resSnapshot = await db.collection('TaskExpenseExtra')
        .where('performAt', '<=', nowDate)
        // .where('status', '==', 'schedule')
        .get()

    console.log('resSnapshot -> ', resSnapshot.docs.length);
    var listData = resSnapshot.docs.filter((ele) => ele.data().status == 'schedule')
    var start = true
    if(start == true){
        if(listData.length > 0){
            for (const doc of listData) {
                var task = doc.data()
                var compId = task.compId
                var performAt = task.performAt
                var docMoneyID = task.docMoneyID
                var status = task.status
                var task_id = doc.id

                var resTaskMoneyExtra = await db.collection(compId + 'ExpenseExtra').doc(docMoneyID).get()
                var moneyData = resTaskMoneyExtra.data()
                //ถ้าข้อมูลการตั้งค่ายังอยู่ค่อยทำ
                if (moneyData != undefined) {
                    var docActive = moneyData.AutoAdd
                    var listUserProcess = []
                    for (let i = 0; i < moneyData.UserInGroupUser.length; i++) {
                        var userProcess = moneyData.UserInGroupUser[i];
                        listUserProcess.push(userProcess.UserID)
                    }


                    var newPerformAt = moment.tz(performAt.toDate(), 'Asia/Bangkok').add('months', 1)

                    var _addMoney = await expenseMoney(docMoneyID, moneyData, compId) //หักเงินพิเศษ

                    console.log('_addMoney -> ', _addMoney);

                    if(_addMoney == 'success'){
                        await db.collection('TaskExpenseExtra').doc(doc.id).update({performAt : newPerformAt})
                        var dateSaveSata = moment.tz('Asia/Bangkok').toDate()
                        var dataUpdate = {
                            saveForm: 'หักอัตโนมัติเมื่อวันที่ ' + now_date + ' ' + now_time,
                            DocExpenseExtra: moneyData,
                            ExpenseExtraID: moneyData.ID,
                            Timestamp: dateSaveSata,
                        }
                        await db.collection(compId + 'ExpenseExtraLog').doc().set(dataUpdate)

                    }
                }
                
            }
        }
    }

    return 'success'
})

function expenseMoney(_docId, obj, compId) {
    return new Promise(async (resolve, reject) => {
        var startDate = moment.tz('Asia/Bangkok').startOf('month').format('YYYY-MM-DD')
        var endDate = moment.tz('Asia/Bangkok').endOf('month').format('YYYY-MM-DD')
        var payDate = moment.tz('Asia/Bangkok').endOf('month').format('YYYY-MM-DD') 

        console.log('startDate -> ', startDate);
        console.log('endDate -> ', endDate);
        console.log('payDate -> ', payDate);

        for (const item of obj.UserInGroupUser) {
            var collectionUser = await db.collection(compId + 'User').doc(item.UserID).get()
            var _docUser = collectionUser.data()
            if(_docUser != undefined){
                const _data = {
                    userId: item.UserID,
                    compId: compId,
                    startDate: startDate,
                    endDate: endDate,
                    payDate: payDate,
                    profileId: _docUser.Profile_ID,
                    docUser: _docUser,
                    addMoneyExtra: obj,
                }

                // console.log('_docUser',_docUser);
                var docStringDate = moment.tz('Asia/Bangkok').format('YYYYMM')
                var docMoneyExtra = obj

                console.log('docStringDate -> ', item.UserID +'_'+docStringDate , compId);

                var collectionPayroll = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringDate)
                var docPayrollGet = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringDate).get()
                var docPayroll = docPayrollGet.data()
                if(docPayroll != undefined){
                    
                    var indexData = docPayroll.ExpenseNameTextList.findIndex((ele) => ele == docMoneyExtra.Name)
                    var dataUpdate = {
                        SetUserId: item.UserID
                    }
                    if(indexData != -1){ ///ซ้ำ
                        console.log('ซ้ำ');
                        // var newNameList = docMoneyExtra.Name
                        // var newMoneyTextList = (Number(docPayroll.ExpenseMoneyTextList[indexData]) + Number(docMoneyExtra.Money))
                        // var newHintTextList = docMoneyExtra.Name + ' ' + addComma(newMoneyTextList) + ' บาท'

                        // docPayroll.ExpenseMoneyTextList[indexData] = newMoneyTextList.toFixed(2) + ''
                        // docPayroll.ExpenseHintTextList[indexData] = newHintTextList
                        // docPayroll.ExpenseNameTextList[indexData] = newNameList
                        // dataUpdate ={
                        //     ExpenseMoneyTextList: docPayroll.ExpenseMoneyTextList,
                        //     ExpenseHintTextList: docPayroll.ExpenseHintTextList,
                        //     ExpenseNameTextList: docPayroll.ExpenseNameTextList
                        // }
                        // console.warn('dataUpdate มีแล้ว -> ', dataUpdate);
                        // collectionPayroll.update(dataUpdate)

                    }else{
                        var newNameList = docMoneyExtra.Name
                        var newMoneyTextList = Number(docMoneyExtra.Money)
                        var newHintTextList = docMoneyExtra.Name + ' ' + addComma(newMoneyTextList) + ' บาท'

                        docPayroll.ExpenseMoneyTextList.push(newMoneyTextList.toFixed(2) + '')
                        docPayroll.ExpenseHintTextList.push(newHintTextList)
                        docPayroll.ExpenseNameTextList.push(newNameList)
                        dataUpdate ={
                            ExpenseMoneyTextList: docPayroll.ExpenseMoneyTextList,
                            ExpenseHintTextList: docPayroll.ExpenseHintTextList,
                            ExpenseNameTextList: docPayroll.ExpenseNameTextList
                        }

                        console.warn('dataUpdate ไม่มี -> ', dataUpdate);
                        // collectionPayroll.update(dataUpdate)
                        await collectionPayroll.update(dataUpdate)
                    }

                    var endDay = 31
                    var startDay = Number(obj.AutoAddDate)
                    var lengthData = endDay - startDay

                    for (let i = 0; i <= lengthData; i++) {
                        var _day = startDay + i
                        var newDay = _day
                        if(_day < 10){
                            newDay = '0' + _day
                        }
                        var docStringMonthDay = moment.tz('Asia/Bangkok').format('YYYYMM') + newDay
                        var docPayrollGetDay = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringMonthDay).get()
                        if(docPayrollGetDay.data() != undefined){
                            console.log('docStringMonthDay -> ', docStringMonthDay);
                            await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringMonthDay).update(dataUpdate)
                        }

                    }
                }else{
                   
                    var dataCreatePayroll = {}
                    dataCreatePayroll['ExpenseNameTextList'] = ['ภาษี', 'WHT', 'ประกันสังคม', 'สายขาดลา', 'หักอื่นๆ', 'รายได้รับล่วงหน้า', docMoneyExtra.Name]
                    dataCreatePayroll['IncomeNameList'] = ['เงินเดือน', 'เบี้ยขยัน', 'โอที', 'คอมมิชชั่น', 'โบนัส', 'รายได้อื่นๆ']
                    dataCreatePayroll['OtherNameTextList'] = ['รายได้สะสม', 'ภาษีสะสม', 'WHT สะสม', 'ประกันสังคมสะสม']

                    dataCreatePayroll['IncomeHintTextList'] = ['เงินเดือน ' + addComma(_docUser.Salary) +' บาท', 'เบี้ยขยัน ' + addComma(_docUser.SalaryDiligent) + ' บาท', 'โอที 0.00 บาท', 'คอมมิชชั่น 0.00 บาท', 'โบนัส 0.00 บาท', 'รายได้อื่นๆ 0.00 บาท']
                    dataCreatePayroll['ExpenseHintTextList'] = ['ภาษี 0.00 บาท', 'WHT 0.00 บาท', 'ประกันสังคม 0.00 บาท', 'สายขาดลา 0.00 บาท', 'หักอื่นๆ 0.00 บาท', 'รายได้รับล่วงหน้า 0.00 บาท', docMoneyExtra.Name + ' ' + addComma(docMoneyExtra.Money) + ' บาท']
                    dataCreatePayroll['OtherHintTextList'] = ['รายได้สะสม 0.00 บาท', 'ภาษีสะสม 0.00 บาท', 'WHT สะสม 0.00 บาท', 'ประกันสังคมสะสม 0.00 บาท']

                    dataCreatePayroll['IncomeMoneyTextList'] = [addCommaPoint(_docUser.Salary) + '', addCommaPoint(_docUser.SalaryDiligent) + '' , '0.00', '0.00', '0.00', '0.00']
                    dataCreatePayroll['ExpenseMoneyTextList'] = ['0.00', '0.00', '0.00', '0.00', '0.00', '0.00', addCommaPoint(docMoneyExtra.Money)+ '']
                    dataCreatePayroll['OtherMoneyTextList'] = ['0.00', '0.00', '0.00', '0.00']
                    dataCreatePayroll['SetUserId'] = _docUser.User_ID


                    db.collection(compId + 'Payroll').doc(_docUser.User_ID + '_' + docStringDate).set(dataCreatePayroll)

                    console.log('dataCreatePayroll -> ', dataCreatePayroll);
                }
            }

        }

        resolve('success')
    })
}

function addComma(money) {
    if(money != undefined){
        return numeral(money).format('0,0.00')
    }else{
        return '0.00'
    }
}

function addCommaPoint(money) {
    if(money != undefined){
        return numeral(money).format('0.00')
    }else{
        return '0.00'
    }
}

//// 2
// exports.addMoneyExtra = functions.https.onCall(async (data, context) => {
exports.addMoneyExtra = functions.pubsub.schedule("*/5 * * * *").timeZone('Asia/Bangkok').onRun( async(context) => {

    var now = moment.tz('Asia/Bangkok')
    var now_date = now.format('YYYY-MM-DD')
    var now_time = now.format('HH:mm:ss')
    var nowDate = moment(now_date + ' ' + now_time).toDate()

    var resSnapshot = await db.collection('TaskMoneyExtra')
        .where('performAt', '<=', nowDate)
        // .where('status', '==', 'schedule')
        .get()

    console.log('resSnapshot -> ', resSnapshot.docs.length);
    var listData = resSnapshot.docs.filter((ele) => ele.data().status == 'schedule')
    var start = true
    if(start == true){
        if(listData.length > 0){
            for (const doc of listData) {
                var task = doc.data()
                var compId = task.compId
                var performAt = task.performAt
                var docMoneyID = task.docMoneyID
                var status = task.status
                var task_id = doc.id

                var resTaskMoneyExtra = await db.collection(compId + 'MoneyExtra').doc(docMoneyID).get()
                var moneyData = resTaskMoneyExtra.data()
                //ถ้าข้อมูลการตั้งค่ายังอยู่ค่อยทำ
                if (moneyData != undefined) {
                    var docActive = moneyData.AutoAdd
                    var listUserProcess = []
                    for (let i = 0; i < moneyData.UserInGroupUser.length; i++) {
                        var userProcess = moneyData.UserInGroupUser[i];
                        listUserProcess.push(userProcess.UserID)
                    }


                    var newPerformAt = moment.tz(performAt.toDate(), 'Asia/Bangkok').add('months', 1)

                    var _addMoney = await addMoney(docMoneyID, moneyData, compId) //เพิ่มเงินพิเศษ
                    // console.log('_addMoney -> ', _addMoney);
                    if(_addMoney == 'success'){
                        await db.collection('TaskMoneyExtra').doc(doc.id).update({performAt : newPerformAt})
                        var dateSaveSata = moment.tz('Asia/Bangkok').toDate()
                        var dataUpdate = {
                            saveForm: 'หักอัตโนมัติเมื่อวันที่ ' + now_date + ' ' + now_time,
                            DocExpenseExtra: moneyData,
                            ExpenseExtraID: moneyData.ID,
                            Timestamp: dateSaveSata,
                        }
                        await db.collection(compId + 'MoneyExtraLog').doc().set(dataUpdate)

                    }
                }
                
            }
        }
    }

    // return 'success'
})

function addMoney(_docId, obj, compId) {
    return new Promise(async (resolve, reject) => {
        var startDate = moment.tz('Asia/Bangkok').startOf('month').format('YYYY-MM-DD')
        var endDate = moment.tz('Asia/Bangkok').endOf('month').format('YYYY-MM-DD')
        var payDate = moment.tz('Asia/Bangkok').endOf('month').format('YYYY-MM-DD') 

        console.log('startDate -> ', startDate);
        console.log('endDate -> ', endDate);
        console.log('payDate -> ', payDate);

        for (const item of obj.UserInGroupUser) {
            var collectionUser = await db.collection(compId + 'User').doc(item.UserID).get()
            var _docUser = collectionUser.data()
            if(_docUser != undefined){
                const _data = {
                    userId: item.UserID,
                    compId: compId,
                    startDate: startDate,
                    endDate: endDate,
                    payDate: payDate,
                    profileId: _docUser.Profile_ID,
                    docUser: _docUser,
                    addMoneyExtra: obj,
                }

                // console.log('_docUser',_docUser);
                var docStringDate = moment.tz('Asia/Bangkok').format('YYYYMM')
                var docMoneyExtra = obj

                console.log('docStringDate -> ', item.UserID +'_'+docStringDate , compId);

                var collectionPayroll = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringDate)
                var docPayrollGet = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringDate).get()
                var docPayroll = docPayrollGet.data()
                if(docPayroll != undefined){
                    
                    var indexData = docPayroll.IncomeNameList.findIndex((ele) => ele == docMoneyExtra.Name)
                    var dataUpdate = {
                        SetUserId: item.UserID
                    }
                    if(indexData != -1){ ///ซ้ำ
                        // var newMoneyTextList = (Number(docPayroll.IncomeMoneyTextList[indexData]) + Number(docMoneyExtra.Money))
                        // var newHintTextList = docMoneyExtra.Name + ' ' + addComma(newMoneyTextList) + ' บาท'

                        // docPayroll.IncomeMoneyTextList[indexData] = newMoneyTextList.toFixed(2) + ''
                        // docPayroll.IncomeHintTextList[indexData] = newHintTextList
                        // dataUpdate ={
                        //     IncomeMoneyTextList: docPayroll.IncomeMoneyTextList,
                        //     IncomeHintTextList: docPayroll.IncomeHintTextList
                        // }
                        // console.warn('dataUpdate มีแล้ว -> ', dataUpdate);
                        // collectionPayroll.update(dataUpdate)

                    }else{
                        var newNameList = docMoneyExtra.Name
                        var newMoneyTextList = Number(docMoneyExtra.Money)
                        var newHintTextList = docMoneyExtra.Name + ' ' + addComma(newMoneyTextList) + ' บาท'

                        docPayroll.IncomeMoneyTextList.push(newMoneyTextList.toFixed(2) + '')
                        docPayroll.IncomeHintTextList.push(newHintTextList)
                        docPayroll.IncomeNameList.push(newNameList)
                        dataUpdate ={
                            IncomeMoneyTextList: docPayroll.IncomeMoneyTextList,
                            IncomeHintTextList: docPayroll.IncomeHintTextList,
                            IncomeNameList: docPayroll.IncomeNameList
                        }

                        console.warn('dataUpdate ไม่มี -> ', dataUpdate);
                        // collectionPayroll.update(dataUpdate)
                    }

                    await collectionPayroll.update(dataUpdate)

                    var endDay = 31
                    var startDay = Number(obj.AutoAddDate)
                    var lengthData = endDay - startDay

                    for (let i = 0; i <= lengthData; i++) {
                        var _day = startDay + i
                        var newDay = _day
                        if(_day < 10){
                            newDay = '0' + _day
                        }
                        var docStringMonthDay = moment.tz('Asia/Bangkok').format('YYYYMM') + newDay
                        var docPayrollGetDay = await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringMonthDay).get()
                        if(docPayrollGetDay.data() != undefined){
                            console.log('docStringMonthDay -> ', docStringMonthDay);
                            await db.collection(compId + 'Payroll').doc(item.UserID +'_'+docStringMonthDay).update(dataUpdate)
                        }
                    }
                }else{
                   
                    var dataCreatePayroll = {}
                    dataCreatePayroll['ExpenseNameTextList'] = ['ภาษี', 'WHT', 'ประกันสังคม', 'สายขาดลา', 'หักอื่นๆ', 'รายได้รับล่วงหน้า']
                    dataCreatePayroll['IncomeNameList'] = ['เงินเดือน', 'เบี้ยขยัน', 'โอที', 'คอมมิชชั่น', 'โบนัส', 'รายได้อื่นๆ', docMoneyExtra.Name]
                    dataCreatePayroll['OtherNameTextList'] = ['รายได้สะสม', 'ภาษีสะสม', 'WHT สะสม', 'ประกันสังคมสะสม']

                    dataCreatePayroll['IncomeHintTextList'] = ['เงินเดือน ' + addComma(_docUser.Salary) +' บาท', 'เบี้ยขยัน ' + addComma(_docUser.SalaryDiligent) + ' บาท', 'โอที 0.00 บาท', 'คอมมิชชั่น 0.00 บาท', 'โบนัส 0.00 บาท', 'รายได้อื่นๆ 0.00 บาท', docMoneyExtra.Name + ' ' + addComma(docMoneyExtra.Money) + ' บาท']
                    dataCreatePayroll['ExpenseHintTextList'] = ['ภาษี 0.00 บาท', 'WHT 0.00 บาท', 'ประกันสังคม 0.00 บาท', 'สายขาดลา 0.00 บาท', 'หักอื่นๆ 0.00 บาท', 'รายได้รับล่วงหน้า 0.00 บาท']
                    dataCreatePayroll['OtherHintTextList'] = ['รายได้สะสม 0.00 บาท', 'ภาษีสะสม 0.00 บาท', 'WHT สะสม 0.00 บาท', 'ประกันสังคมสะสม 0.00 บาท']

                    dataCreatePayroll['IncomeMoneyTextList'] = [addCommaPoint(_docUser.Salary) + '', addCommaPoint(_docUser.SalaryDiligent) + '' , '0.00', '0.00', '0.00', '0.00', , addCommaPoint(docMoneyExtra.Money)+ '']
                    dataCreatePayroll['ExpenseMoneyTextList'] = ['0.00', '0.00', '0.00', '0.00', '0.00', '0.00']
                    dataCreatePayroll['OtherMoneyTextList'] = ['0.00', '0.00', '0.00', '0.00']
                    dataCreatePayroll['SetUserId'] = _docUser.User_ID


                    db.collection(compId + 'Payroll').doc(_docUser.User_ID + '_' + docStringDate).set(dataCreatePayroll)

                    console.log('dataCreatePayroll -> ', dataCreatePayroll);
                }
            }

        }

        resolve('success')
    })
}

/// 4
exports.apiCalTax = functions.https.onCall(async(data, context) => {
    if (data != undefined) {
        const _compId = data.compId
        const salary = data.salary //เงินเดือน
        const moneyPay = data.moneyPay //หักค่าใช้จ่าย
        const deduc = data.deduc //หักค่าลดหย่อน
        const m33 = data.m33 //หักค่าลดหย่อน
        var tax = 0.0

        // var amount = (salary * 12);
        var amount = salary * 12.0 - moneyPay - deduc - m33

        var vatCutPercent = 0
        if (amount <= 150000) {
            vatCutPercent = 0
            tax = 0.0
        } else if (amount > 150000 && amount <= 300000) {
            vatCutPercent = 5
            tax = (amount - 150000) * (5 / 100)
            tax = tax > 7500 ? 7500 : tax
        } else if (amount > 300000 && amount <= 500000) {
            vatCutPercent = 10
            tax = (amount - 300000) * (10 / 100) + 7500
            tax = tax > 27500 ? 27500 : tax
        } else if (amount > 500000 && amount <= 750000) {
            vatCutPercent = 15
            tax = (amount - 500000) * (15 / 100) + 27500
            tax = tax > 65000 ? 65000 : tax
        } else if (amount > 750000 && amount <= 1000000) {
            vatCutPercent = 20
            tax = (amount - 750000) * (20 / 100) + 65000
            tax = tax > 115000 ? 115000 : tax
        } else if (amount > 1000000 && amount <= 2000000) {
            vatCutPercent = 25
            tax = (amount - 1000000) * (25 / 100) + 115000
            tax = tax > 365000 ? 365000 : tax
        } else if (amount > 2000000 && amount <= 5000000) {
            vatCutPercent = 30
            tax = (amount - 2000000) * (30 / 100) + 365000
            tax = tax > 1265000 ? 1265000 : tax
        }

        var taxPerMonth = tax / 12
        var result = {
            vatCutPercent: vatCutPercent,
            taxAllYear: Number(tax.toFixed(2)),
            taxPerMonth: Number(taxPerMonth.toFixed(2)),
        }
        return result
    } else {
        return 'no data send'
    }
})

/// 5
exports.apiGetCompanyCode = functions.https.onCall(async(data, context) => {
    if (data != undefined) {
        var comCode = await db.collection('CompanyCode').get();
        var result = [];
        console.log('-->comCode.docs.length',comCode.docs.length);
        for (var i = 0; i < comCode.docs.length; i++) {
            var doc = comCode.docs[i].data();

            var user = await db.collection(doc.CompCode.toString() + 'User').where('UserType', '==', 'ceo').get();
            if (user.docs.length > 0) {
                var doc_user = user.docs[0].data();
                console.log('-->doc.CompCode', doc.CompCode);
                var resData = {
                    CompanyName: doc.Name,
                    CompanyCode: doc.CompCode,
                    UserAdmin: doc_user.Username,
                    UserPassword: doc_user.Password
                }
                result.push(resData);
            }

        }

        return result;
    } else {
        return 'no data'
    }

})

/// 
// exports.autoRecordROPD = functions.https.onCall(async(data, context) => {
exports.autoRecordROPD = functions.pubsub.schedule("*/5 * * * *").timeZone('Asia/Bangkok').onRun(async(context) => {
    console.log('xxxxx');
    var now = moment.tz('Asia/Bangkok')
    var now_date = now.format('YYYY-MM-DD')
    var now_time = now.format('HH:mm:ss')
    var nowDate = moment(now_date + ' ' + now_time).toDate()

    console.log('bbbb');

    var resSnapshot = await db.collection('TaskLog')
        // .where('performAt', '<=', nowDate)
        .where('status', '==', 'schedule')
        // .where('compId', '==', '1607')
        .get()

    console.log('resSnapshot -> ', resSnapshot.docs.length);

    if (resSnapshot.docs.length > 0) {
        for (const doc of resSnapshot.docs) {
            const task = doc.data()
            var compId = task.compId
            var performAt = task.performAt
            var autoID = task.AutoID
            var status = task.status
            var task_id = doc.id
            const roundFix = 50 //กำหนดให้ทำทุก 5 นาที ทำแค่ 50 คนเท่านั้น
            let countPeople = 0 //นับว่าทำครบ 50 คนไหม

            console.log('compId -> ', compId);

            // if(compId == '1607'){



            var resTaskLogRoundAutoLog = await db.collection('TaskLogRoundAuto').doc(compId + '_' + autoID).get()
            var resAutoLogData = await db.collection(compId + 'LogAuto').doc(autoID).get()
            var autoData = resAutoLogData.data()
                // console.log('resAutoLogData', resAutoLogData.data());
                // console.log('resTaskLogRoundAutoLog', resTaskLogRoundAutoLog.data());

            var breakRound = false; //ตัวเช็คว่าให้สั่งเปลี่ยนรอบไหม
            var finalRound = false; //ตัวเช็คว่ารอบสุดท้ายหรือไม่

            if (autoData != undefined) {

                var allUserInCompany = await db.collection(compId + 'User').where('Status', '==', 1).get()
                console.log('allUserInCompany', allUserInCompany.docs.length);
                var filterUserInList = allUserInCompany.docs.map(doc => doc.data());
                let arrTaskLogRoundAutoLog = []
                let countAllPeople = 0

                console.log('autoData.GroupProfile.length', autoData.GroupProfile.length);
                if (autoData.GroupProfile.length > 0) {
                    //ถ้า Auto Log ตั้งไว้เลือกเฉพาะกลุ่ม
                    filterUserInList = filterUserInList.filter(item => autoData.GroupProfile.findIndex(ele => ele == item.Profile_ID) != -1)

                }

                if (resTaskLogRoundAutoLog.data() != undefined) {
                    //ถ้ามีข้อมูลใน TaskLogRoundAutoLog ให้เอาค่าไปเก็บไว้ใน arrTaskLogRoundAutoLog
                    countAllPeople = resTaskLogRoundAutoLog.data().countAllPeople
                    if (countAllPeople > 0) {
                        arrTaskLogRoundAutoLog = resTaskLogRoundAutoLog.data().taskLogRoundAutoLog
                        console.log('arrTaskLogRoundAutoLog.length', arrTaskLogRoundAutoLog.length);
                        filterUserInList = filterUserInList.filter(item => arrTaskLogRoundAutoLog.findIndex(ele => ele == item.User_ID) == -1)
                    }
                } else {
                    //ถ้าไม่มีข้อมูลใน TaskLogRoundAutoLog ให้เพิ่มจำนวนคนที่ต้องทำ Log ลงไปใน doc TaskLogRoundAutoLog
                    await db.collection('TaskLogRoundAuto').doc(compId + '_' + autoID).set({
                        countAllPeople: filterUserInList.length,
                    });
                    countAllPeople = filterUserInList.length
                }
                console.log('countAllPeople', countAllPeople);
                console.log('filterUserInList', filterUserInList.length);
                if (countAllPeople == 0) {
                    //ถ้าเป็นเคส ไม่มีคนในกลุ่มเลย ให้ถือว่าเป็น รอบสุดท้าย
                    finalRound = true
                }

                var logActive = autoData.Status
                var listUserProcess = []
                var listCheckBox = autoData.listBox.filter((ele) => ele.model == true)

                // console.log('Jay compId -> ', logActive, listCheckBox);
                if (autoData.UserProcess.length > 0) {
                    for (let i = 0; i < autoData.UserProcess.length; i++) {
                        var userProcess = autoData.UserProcess[i];
                        listUserProcess.push(userProcess.model)
                    }
                }

                //ถ้า ตั้งค่า Auto ถูกปิดแล้วก็ไม่ต้องทำต่อ
                if (logActive == 'ใช้งาน') {
                    var listUserID = autoData.GroupUserId
                    console.log('listUserID -> ', listUserID.length);
                    for (const userDoc of filterUserInList) {
                        // for (const userId of listUserID) {
                        if (countPeople == roundFix || finalRound == true) {
                            console.log('หมดรอบแล้ว หรือ รอบสุดท้าย countPeople = ' + countPeople + ' finalRound = ' + finalRound);
                            break;
                        }


                        // var queryUser = await db.collection(compId + 'User').doc(userId).get()
                        // var docUser = queryUser.data()
                        var docUser = userDoc


                        if (docUser != undefined) {
                            console.log('Firstname -> ', docUser.Firstname);
                            if (listCheckBox.length > 0) {
                                for (let i = 0; i < listCheckBox.length; i++) {
                                    const listBox = listCheckBox[i];
                                    var addLog = {}
                                    addLog['CompCode'] = compId
                                    addLog['Detail'] = 'บริษัทได้จัดเก็บข้อมูล ' + listBox.label + ' เพื่อ' + autoData.SubTitle
                                    addLog['Lang'] = 'th'
                                    addLog['Profile_ID'] = docUser.Profile_ID
                                    addLog['TimeStamp'] = performAt
                                    addLog['User_ID'] = docUser.User_ID
                                    addLog['UserProcessor'] = listUserProcess
                                    addLog['TimeStamp_Auto'] = moment.tz('Asia/Bangkok').toDate()
                                    addLog['type'] = 'Auto'
                                    await db.collection(compId + 'User').doc(docUser.User_ID).collection('Log').doc().set(addLog)
                                        // await db.collection('0000User').doc(userId).collection('Log').doc().set(addLog)

                                }
                                arrTaskLogRoundAutoLog.push(docUser.User_ID) //เพิ่มคนที่ทำ Log ไปแล้วไปใน arrTaskLogRoundAutoLog
                                countPeople++
                                await db.collection('TaskLogRoundAuto')
                                    .doc(compId + '_' + autoID)
                                    .update({
                                        taskLogRoundAutoLog: arrTaskLogRoundAutoLog,
                                    });
                            }

                            //เพิ่มเช็คว่าเป็นรอบสุดท้ายแล้วหรือไม่
                            console.log('arrTaskLogRoundAutoLog.length ', arrTaskLogRoundAutoLog.length, countAllPeople);
                            if (arrTaskLogRoundAutoLog.length > 0) {
                                if (arrTaskLogRoundAutoLog.length == countAllPeople) {
                                    finalRound = true
                                }
                            }
                        }

                    }
                }
            }

            console.log('finalRound', finalRound);
            if (finalRound == true) {
                console.log('update New Task', doc.id, { status: 'complete', updatedAt: nowDate });
                await db.collection('TaskLogRoundAuto').doc(compId + '_' + autoID).delete();
                // if(compId == '1607'){
                await db.collection('TaskLog').doc(doc.id).update({ status: 'complete', updatedAt: nowDate })
                    // }
                    // await db.collection('0000TaskLog').doc(doc.id).set({ status: 'complete', updatedAt: nowDate })

                var resSettingAutoLog = await db.collection(compId + 'LogAuto').doc(autoID).get()
                if (resSettingAutoLog.data() != undefined) {
                    var dataLog = resSettingAutoLog.data()
                    console.log('dataLog.Type ', dataLog.Type);

                    if (dataLog.Status == 'ใช้งาน') {
                        if (dataLog.Type == 'auto') {
                            var weekendTrue = dataLog.Weekend
                            var listDayTrue = []
                            var tomorrow = moment.tz('Asia/Bangkok').add(1, 'days').format('YYYY-MM-DD')
                            for (let i = 0; i < 7; i++) {
                                var dayTomorrow = moment(tomorrow).format('ddd')

                                if (weekendTrue[dayTomorrow] == true) {
                                    listDayTrue.push(tomorrow)
                                }
                                tomorrow = moment(tomorrow).add(1, 'days')
                            }

                            var newDateTomorrow = moment(moment.tz(listDayTrue[0], 'Asia/Bangkok').format('YYYY-MM-DD') + ' ' + dataLog.StartTime).toDate()
                            console.log('newDateTomorrow -> ', newDateTomorrow);

                            var addTask = {
                                compId: compId,
                                performAt: newDateTomorrow,
                                status: 'schedule',
                                AutoID: autoID,
                            }

                            console.log('addTask', addTask)
                                // await db.collection('TaskLog').add(addTask);
                            await db.collection('TaskLog').doc().set(addTask);

                        } else if (dataLog.Type == 'auto salary') {
                            if (dataLog.ListDayActive.length > 0) {
                                var listDayActive = dataLog.ListDayActive
                                var _nowDate = moment.tz('Asia/Bangkok').format('YYYY-MM-DD')
                                var _newDate = moment(_nowDate + ' 00:00:00').toDate()
                                listDayActive.sort(function(a, b) {
                                    if (a < b) {
                                        return -1
                                    }
                                    if (a > b) {
                                        return 1
                                    }
                                    return 0
                                })

                                var _performAt = moment().toDate()

                                for (let i = 0; i < listDayActive.length; i++) {
                                    var _day = listDayActive[i]
                                    console.log('_day -> ', _day);
                                    var formatDate = moment(_day + ' 00:00:00').toDate()
                                    console.log('jak _nowDate', _nowDate);
                                    console.log('jak formatDate', formatDate);
                                    console.log('jak _nowDate < formatDate ', _nowDate < formatDate);
                                    if (_newDate < formatDate) {
                                        console.warn('มาก')
                                        _performAt = formatDate
                                        break
                                    } else {
                                        _performAt = ''
                                        console.warn('น้อย')
                                    }
                                }
                                console.log('_performAt', _performAt);

                                if (_performAt != '') {
                                    var addTask = {
                                        compId: compId,
                                        performAt: _performAt,
                                        status: 'schedule',
                                        AutoID: autoID,
                                    }

                                    console.log('addTask', addTask)
                                        // await db.collection('TaskLog').add(addTask);
                                    await db.collection('TaskLog').doc().set(addTask);
                                }

                            }
                        }
                        // console.log('listDayTrue', listDayTrue[0] + ' ' + docAutoTaskLog.StartTime);
                    }
                }

            }
            break
            // }
        }
    }

    return 'success'
})

exports.checkCreateCompany = functions.firestore.document('CompanyCode/{documentId}').onCreate((snap, context) => {
    const newValue = snap.data();
    var dateNow =  moment().toDate()
    var dateNew = moment(dateNow).add(1, 'months')
    var dataCreate = {
        CompCode: newValue.CompCode,
        DateCreate: moment().toDate(),
        DateExpired: dateNew.toDate()
    }

    if(newValue.PDPA != undefined){
        dataCreate['PDPA'] = 'PDPA'
        dataCreate['action'] = 'ทดลองใช้งานอยู่'
    }

    db.collection('CompanyCreate')
        .doc(newValue.CompCode + '')
        .set(dataCreate).then(() => {

        })

    db.collection('CompanyCode').doc(newValue.CompCode + '').update({TypeCheckIn5: true})

})

exports.checkDuplicateInOut = functions.https.onCall(async(data, context) => {
    if (data != undefined) {
        const compCode = data.compCode;
        const userId = data.userId; //user id
        const typeInOut = data.typeInOut; //type ตรวจสอบ เช็คอินซ้ำ หรือเช็คเอ้าซำ้

        if (typeInOut == 'in') { //ให้ตรวจสอบเช็คอินซ้ำ
            // const checkInRef = await db.collection(compCode + 'CheckIn').doc(userId).get()
            // var checkIn = checkInRef.data()
            //     // console.log('checkIn', checkIn['CheckIn'].length);

            // var Remove_duplicate_Value = [];
            // for (var i = 0; i < checkIn['CheckIn'].length; i++) {
            //     const checkInJson = checkIn['CheckIn'][i];

            //     Remove_duplicate_Value.findIndex(ele => moment(ele.CheckInTime.toDate()).format('YYYY-MM-DD HH:mm:ss') == moment(checkInJson.CheckInTime.toDate()).format('YYYY-MM-DD HH:mm:ss')) == -1 ? Remove_duplicate_Value.push(checkInJson) : '';

            // }
            // // console.log('Remove_duplicate_Value', Remove_duplicate_Value.length);
            // await db.collection(compCode + 'CheckIn').doc(userId).update({
            //     "CheckIn": Remove_duplicate_Value
            // });
            console.log('ลบเช็คอินท์ซ้ำสำเร็จ ปิดไว้ก่อน');
            // console.log(compCode + ' ' + userId + ' ลบเช็คอินท์ซ้ำสำเร็จ lenght ก่อนลบ ' + checkIn['CheckIn'].length + ' หลังลบ ' + Remove_duplicate_Value.length);
            // return 'ลบเช็คอินท์ซ้ำสำเร็จ lenght ก่อนลบ ' + checkIn['CheckIn'].length + ' หลังลบ ' + Remove_duplicate_Value.length;
            return 'ลบเช็คอินท์ซ้ำสำเร็จ ปิดไว้ก่อน'
        }

        if (typeInOut == 'out') { //ให้ตรวจสอบเช็คอินซ้ำ
            // const checkOutRef = await db.collection(compCode + 'CheckOut').doc(userId).get()
            // var checkOut = checkOutRef.data()
            //     // console.log('checkOut', checkOut['CheckOut'].length);

            // var Remove_duplicate_Value = [];
            // for (var i = 0; i < checkOut['CheckOut'].length; i++) {
            //     const checkOutJson = checkOut['CheckOut'][i];
            //     Remove_duplicate_Value.findIndex(ele => moment(ele.CheckOutTime.toDate()).format('YYYY-MM-DD HH:mm:ss') == moment(checkOutJson.CheckOutTime.toDate()).format('YYYY-MM-DD HH:mm:ss')) == -1 ? Remove_duplicate_Value.push(checkOutJson) : '';
            // }
            // // console.log('Remove_duplicate_Value', Remove_duplicate_Value.length);
            // await db.collection(compCode + 'CheckOut').doc(userId).update({
            //     "CheckOut": Remove_duplicate_Value
            // });
            // console.log(compCode + ' ' + userId + ' ลบเช็คเอ้าท์ซ้ำสำเร็จ lenght ก่อนลบ ' + checkOut['CheckOut'].length + ' หลังลบ ' + Remove_duplicate_Value.length);
            // return 'ลบเช็คเอ้าท์ซ้ำสำเร็จ lenght ก่อนลบ ' + checkOut['CheckOut'].length + ' หลังลบ ' + Remove_duplicate_Value.length;
            console.log('ลบเช็คเอ้าท์ซ้ำ ปิดไว้ก่อน');
            return 'ลบเช็คเอ้าท์ซ้ำ ปิดไว้ก่อน'
        }
    }
});

exports.CountLate = functions.runWith({timeoutSeconds: 540, memory: '1GB',}).https.onCall(async(data, context) => {
// exports.CountLate = functions.runWith({
//     timeoutSeconds: 540,
//     memory: "1GB",
// }).https.onRequest(async(req, res) => {
    // exports.CountLate = functions.pubsub.schedule("*/5 * * * *").timeZone('Asia/Bangkok').onRun(async(context) => {
    var selectStartDate = moment.tz('Asia/Bangkok').startOf('month').format('YYYY-MM-DD');
    var selectEndDate = moment.tz('Asia/Bangkok').endOf('month').format('YYYY-MM-DD');

    // db.collection('CompanyCreate')
    //     .where('action', '==', 'เป็นลูกค้าแล้ว')
    //     // .where('CompCode', '==', 1001)
    //     .get()
    //     .then(async snapQuery => {
    //         console.log('snapQuery.docs.length', snapQuery.docs.length);
    //         for (const docCompCreate of snapQuery.docs) {

    // const docCompCreateData = docCompCreate.data();
    console.log('data', data);
    // let compId = data.body.compId;  //ตัวที่ถูก
    let compId = data.compId;
    console.log('compId', compId);
    var profiledataRef = await db.collection(compId + 'StandardProfile').get();
    let profiledataAll = profiledataRef.docs.map(doc => doc.data());
    // console.log('profiledataAll', profiledataAll);
    //ข้อมูลวันหยุดประจำปี
    var holidayData = {}
    if (
        moment(selectStartDate).format('YYYY') ==
        moment(selectEndDate).format('YYYY')
    ) {
        //กรณีปีเริ่มต้นที่ดึงข้อมูลเป็นปีเดียวกันกับปีที่สิ้นสุดการดึงข้อมูล
        var _tmpHoliday = await db
            .collection(compId + 'CompanyHoliday')
            .doc(moment(selectStartDate).format('YYYY'))
            .get()


        if (_tmpHoliday.data() == undefined) {
            //กรณีที่เปลี่ยนปีใหม่
            var dataInsert = {
                Holiday: [],
                HolidayName: [],
            }

            holidayData = dataInsert
        } else {
            //กรณีที่เป็นปีปัจจุบัน
            holidayData = _tmpHoliday.data()
        }
    } else {
        //กรณีดึงข้อมูลข้ามปี
        var _tmpHolidayStart = await db
            .collection(compId + 'CompanyHoliday')
            .doc(moment(selectStartDate).format('YYYY'))
            .get()

        var _tmpHolidayEnd = await db
            .collection(compId + 'CompanyHoliday')
            .doc(moment(selectStartDate).format('YYYY'))
            .get()

        holidayData['Holiday'] = _tmpHolidayStart
            .data()
            .Holiday.concat(_tmpHolidayEnd.Holiday)
        holidayData['HolidayName'] = _tmpHolidayStart
            .data()
            .HolidayName.concat(_tmpHolidayEnd.HolidayName)
    }
    var showDataSummary = {
        SexMan: 0,
        SexWomen: 0,
        AvgLate: 0,
        SumLateMinite: 0,
        LateCountPeople: 0,
        LeaveCountPeople: 0,
        MissingCountPeople: 0,
        OtCountPeople: 0,
        OtHour: 0,
        MoneyNetSum: 0,
        WorkDaySum: 0,
        WeekendCount: 0,
        HolidayCount: 0,
        LeaveDaySum: 0,
    }

    var snapQueryUser = await db.collection(compId + 'User').where('Status', '==', 1).get();
    console.log('snapQueryUser.docs.length', snapQueryUser.docs.length);
    var iuser = 1;
    for (const docUser of snapQueryUser.docs) {
        console.log('compId', compId, 'คนที่', iuser);
        let item = docUser.data();
        // console.log('item.profiledataAll', profiledataAll.length);
        let profiledata = profiledataAll.find(ele => ele.ID == item.Profile_ID);
        // console.log('profiledata', profiledata.Name);
        // console.log('profiledata.UseTimeLateMinite', profiledata.UseTimeLateMinite == '1');

        if (item.UserType != 'ceo' && profiledata != undefined) {
            var _checkLateForProfile = profiledata.TimeLate
            item['docId'] = docUser.id
            var beforeName = ''
            if (item.Beforename != undefined) {
                beforeName = item.Beforename
            }
            item['Fullname'] =
                beforeName + ' ' + item.Firstname + ' ' + item.Lastname

            //นับว่าเป็นชายหรือหญิง
            if (item.SexID == 1) {
                //ชาย
                showDataSummary.SexMan++
            } else {
                showDataSummary.SexWomen++
            }

            item['CountDateCheckIn'] = 0
            item['CountDateWeekend'] = 0
            item['CountNotWork'] = 0
            item['CountLeave'] = 0
            item['CountLate'] = 0
            item['SumLateTime'] = 0
            item['CountOt'] = 0
            item['SumOtHour'] = 0

            var SumShiftDay = 0
            var SalaryShift = 0

            const checkIn = await getCheckIn(
                item.User_ID,
                compId,
                profiledata,
                
                selectStartDate,
                selectEndDate
            )
            console.log('checkIn', checkIn.length);
            if (checkIn.length > 0) {
                // console.error();
                // const checkOut = await getCheckOut(item.User_ID,
                //     compId,
                //     selectStartDate,
                //     selectEndDate
                // )
                const leaveDoc = await getLeave(item.User_ID,
                        compId,
                        selectStartDate,
                        selectEndDate
                    )
                    // const lateDoc = await getLate(item.User_ID,
                    //     compId,
                    //     selectStartDate,
                    //     selectEndDate
                    // )
                    // const otDoc = await getOT(item.User_ID,
                    //     compId,
                    //     selectStartDate,
                    //     selectEndDate)
                const employeeShitfDoc = await getEmployeeShitf(
                    item.User_ID,
                    compId,
                    selectStartDate,
                    selectEndDate
                )

                //ดึงข้อมูล ประกาศงาน
                const jobDoc = await getJob(
                        item.User_ID,
                        compId,
                        selectStartDate,
                        selectEndDate
                    )
                    // console.log('jobDoc', jobDoc)

                // item['CountLate'] = lateDoc.length
                // item['DataCheckIn'] = checkIn
                // item['DataCheckOut'] = checkOut

                const currentMomentPeruser = moment(selectStartDate)
                const endMomentPeruser = moment(selectEndDate).add(
                    1,
                    'day'
                )

                //วนคอลัมถ์วันที่เพื่อแสดงผล
                while (
                    currentMomentPeruser.isBefore(endMomentPeruser, 'day')
                ) {
                    var _tmpCheckLate = false //เช็คว่าวันนี้เข้าสายหรือไม่

                    var checkInShow = '-'

                    // console.warn('startcheckInShow', checkInShow)

                    var finded = checkIn.find(
                        (ele) =>
                        moment(ele.CheckInTime.toDate()).format(
                            'YYYY-MM-DD'
                        ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )
                    var filtered = checkIn.filter(
                        (ele) =>
                        moment(ele.CheckInTime.toDate()).format(
                            'YYYY-MM-DD'
                        ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    )

                    // if (filtered) {

                    // }

                    // if (finded != undefined ) {
                    //   // checkOut = checkOut.filtered((ele) => ele.CheckOutTime.toDate() > finded.CheckInTime.toDate())
                    // }

                    // console.error(finded.checkInShow.toDate());

                    // checkOut = checkOut.filter((ele) => ele.CheckOutTime.toDate() > filtered[0].CheckInTime.toDate())
                    // if (finded != undefined) {

                    // console.error('currentMomentPeruser',currentMomentPeruser.toDate());

                    // var findedCheckOut = checkOut.find(
                    //     (ele) =>
                    //     moment(ele.CheckOutTime.toDate()).format(
                    //         'YYYY-MM-DD'
                    //     ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    // )


                    // var findedCheckOutTomorrow = checkOut.find(
                    //     (ele) =>
                    //     moment
                    //     .tz(ele.CheckOutTime.toDate(), 'Asia/Bangkok')
                    //     .format('YYYY-MM-DD') ==
                    //     moment(currentMomentPeruser)
                    //     .add(1, 'days')
                    //     .format('YYYY-MM-DD')
                    // )


                    // var filteredCheckOut = checkOut.filter(
                    //         (ele) =>
                    //         moment(ele.CheckOutTime.toDate()).format(
                    //             'YYYY-MM-DD'
                    //         ) == moment(currentMomentPeruser).format('YYYY-MM-DD')
                    //     )
                    // }

                    // if(item.User_ID == 'GYHK16yj7QIatQty7j60'){
                    //   console.log('Jay -> ', finded.CheckInTime);
                    // console.log('Jay2 -> ', filteredCheckOut);

                    //     for (let i = 0; i < filteredCheckOut.length; i++) {
                    //       const date = filteredCheckOut[i];
                    //       console.log('date', moment(date.CheckOutTime.toDate()).format('DD-MM-YYYY HH:mm'));
                    //     }

                    // }

                    //กรณีมีเช็คอิน
                    var lateTxt = ''
                    var shifAndJobTxt = ''

                    //ตรวจสอบว่าวันนี้มี กะหรือไม่
                    var shiftHave = false //พนักงานมีเข้างานในกะหรือไม่
                    var shiftLate = 0 //พนักงานเข้ากะแล้วสายครั้ง
                    var shiftLateTime = 0 //พนักงานเข้ากะสายนาที
                    var findedShitf = undefined

                    if (finded != undefined) {


                        //ตรวจสอบว่าพนักงานเข้างานจากการประกาศจ๊อบในวันนั้นหรือไม่
                        var jobHave = false //พนักงานมีเข้างานในการประกาศงานหรือไม่
                        var jobLate = 0 //พนักงานเข้าสาย
                        var jobLateTime = 0 //พนักงานเข้าสายนาที
                        if (jobDoc.length > 0) {
                            //พนักงานคนนี้ต้องมีข้อมูลจ็อบในวันนั้นด้วย
                            var findedJob = jobDoc.find(
                                    (ele) =>
                                    ele.StartDate ==
                                    moment(currentMomentPeruser).format('YYYY-MM-DD')
                                )
                                // console.log('-->curdaye', moment(currentMomentPeruser).format('YYYY-MM-DD'));
                                // console.log('-->findedJob', findedJob)
                            if (findedJob != undefined) {
                                jobHave = true
                                var latediff = moment
                                    .tz(finded.CheckInTime.toDate(), 'Asia/Bangkok')
                                    .diff(
                                        moment.tz(
                                            findedJob.StartDate +
                                            ' ' +
                                            findedJob.StartTime,
                                            'Asia/Bangkok'
                                        ),
                                        'minutes'
                                    )
                                    // console.log('-->jobDoclatediff', latediff)
                                if (latediff > 0) {
                                    jobLate = 1
                                    jobLateTime = latediff
                                }
                            }
                        }
                        // console.log('employeeShitfDoc.length',employeeShitfDoc.length);
                        if (employeeShitfDoc.length > 0) {
                            findedShitf = employeeShitfDoc.find(
                                    (ele) =>
                                    ele.Day ==
                                    moment(currentMomentPeruser).format('YYYY-MM-DD')
                                )
                                // console.log('findedShitf',findedShitf);

                            if (findedShitf != undefined) {
                                shiftHave = true

                                if (findedShitf.ShiftDetail.TypeShift != '3') {
                                    //กรณี กะแบบไม่ใช่ freeform ให้ตรวจสอบการเข้างานสาย
                                    // console.log('profiledata.UseTimeLateMinite', profiledata.UseTimeLateMinite,typeof profiledata.UseTimeLateMinite);
                                    if (profiledata.UseTimeLateMinite == 1) {
                                        var latediff = moment
                                            .tz(
                                                finded.CheckInTime.toDate(),
                                                'Asia/Bangkok'
                                            )
                                            .diff(
                                                moment.tz(
                                                    findedShitf.Day +
                                                    ' ' +
                                                    findedShitf.ShiftDetail
                                                    .StartWorkingTime,
                                                    'Asia/Bangkok'
                                                ),
                                                'minutes'
                                            )
                                            // console.log('-->employeeShitfDoclatediff', latediff);
                                        if (latediff > _checkLateForProfile) {
                                            shiftLate = 1
                                            shiftLateTime = latediff
                                        }
                                    }
                                }
                            }
                        }

                        //ถ้าวันนี้มีเข้าจ๊อป ให้ตรวจสอบการสายจากเวลาที่เข้างานเทียบกับเวลาที่ประกาศงาน
                        if (jobHave) {
                            //ถ้ามีจ๊อปแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                            if (jobLateTime > 0) {
                                // CountLate += 1
                                // _tmpCheckLate = true
                                // SumLateTime += Number(jobLateTime)

                                lateTxt = 'สาย ' + jobLateTime + ' นาที \n'
                                item['CountLate'] += 1
                                _tmpCheckLate = true
                                item['SumLateTime'] += Number(jobLateTime)
                            }
                            // if (shiftHave == true) { //ถ้ามีจ็อปและมีเข้ากะด้วย จะได้ค่ากะรวมไปด้วย
                            //     SumShiftDay += 1;
                            //     SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                            // }
                            shifAndJobTxt = '(ประกาศงาน)' + '\n'
                        } else if (shiftHave == true) {
                            //ถ้ามีการเข้ากะให้คิดเงินค่าเข้ากะด้วย
                            // SumShiftDay += 1;
                            // SalaryShift += Number(findedShitf.ShiftDetail.Shift_Value);
                            // console.log('---->findedShitf',findedShitf);
                            if (findedShitf != undefined) {
                                shifAndJobTxt =
                                    '(' + findedShitf.ShiftDetail.Shift_Name + ')\n'
                            }
                            //ถ้ามีกะแต่ไม่สาย แสดงว่ามาตรงเวลาไม่นับสาย
                            // console.log('shiftLateTime',shiftLateTime);
                            if (shiftLateTime > 0) {
                                // CountLate += 1
                                // _tmpCheckLate = true
                                // SumLateTime += Number(shiftLateTime)

                                lateTxt = 'สาย ' + shiftLateTime + ' นาที \n'
                                item['CountLate'] += 1
                                _tmpCheckLate = true
                                item['SumLateTime'] += Number(shiftLateTime)
                            }
                        } else {
                            //ถ้าไม่มีเข้าจ็อปให้ใช้ค่าสแตนดาร์ดเวลาเข้างานปรกติเป็นตัวตรวจสอบ
                            //กรณีมีสาย
                            // if (finded.LateCount != undefined) {
                            //     lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                            //     CountLate += 1
                            //     _tmpCheckLate = true
                            //     SumLateTime += Number(finded.LateTimeMinite)
                            // }
                            if (finded.LateCount != undefined) {
                                lateTxt =
                                    'สาย ' + finded.LateTimeMinite + ' นาที \n'
                                item['CountLate'] += 1
                                _tmpCheckLate = true
                                item['SumLateTime'] += Number(finded.LateTimeMinite)
                            }
                        }

                        // //กรณีมีสาย
                        // if (finded.LateCount != undefined) {
                        //   lateTxt = 'สาย ' + finded.LateTimeMinite + ' นาที \n'
                        //   item['CountLate'] += 1
                        //   _tmpCheckLate = true
                        //   item['SumLateTime'] += Number(finded.LateTimeMinite)
                        // }

                        item['CountDateCheckIn']++
                            checkInShow = moment(
                                finded.CheckInTime.toDate()
                            ).format('เข้า HH:mm ')
                    }

                    //ถ้ามีกะแล้วเป็น type 1 เป็นออกงานข้ามวันให้ทำการดึงออกงานวันถัดไป

                    // console.log('findedCheckOut',findedCheckOut);
                    // if (findedCheckOut != undefined) {
                    //     //หาว่าเป็นเช็คเอ้้าอัตโนมัติหรือไม่
                    //     var txtShowOutAuto = ''
                    //     if (findedCheckOut.QRCodeName == 'อัตโนมัติ') {
                    //         txtShowOutAuto = ' (auto)'
                    //     }

                    //     if (shiftHave == true) {
                    //         if (
                    //             findedCheckOutTomorrow != undefined &&
                    //             findedShitf.ShiftDetail.TypeShift == '1'
                    //         ) {
                    //             checkInShow =
                    //                 checkInShow +
                    //                 moment(
                    //                     findedCheckOutTomorrow.CheckOutTime.toDate()
                    //                 ).format(' - ออก HH:mm') +
                    //                 txtShowOutAuto

                    //             if (findedCheckOutTomorrow.ForgetCheckOut != undefined) {
                    //                 checkInShow = 'ขาด(ลืมเช็คเอ้าท์)'
                    //             }
                    //             // if (item.User_ID == '7hJMvH9g67m0X2uj6LHG' && moment(currentMomentPeruser).format('DD-MM-YYYY') == '24-03-2022') {
                    //             //   console.error('เข้าลูป');

                    //             //   console.error('Jay เข้า 1', checkInShow);
                    //             //   // console.error('Jay 2', moment(moment(inDay).toDate()).format('DD MM YYYY'));
                    //             //   // console.error('Jay 3', moment(filteredCheckOut[0]).format('DD MM YYYY'), moment(filteredCheckOut[1]).format('DD MM YYYY'));
                    //             // }
                    //         } else {
                    //             // console.error('filteredCheckOut.length', filteredCheckOut.length);

                    //             if (filteredCheckOut.length > 1) {


                    //                 //   console.error('Jay 3', moment(filteredCheckOut[0]).format('DD MM YYYY'), moment(filteredCheckOut[1]).format('DD MM YYYY'));
                    //                 // }

                    //                 var inDay = moment(
                    //                     currentMomentPeruser.toDate()
                    //                 ).format(
                    //                     'YYYY-MM-DD ' + checkInShow.split(' ')[1]
                    //                 )

                    //                 var findCheckoutInday = filteredCheckOut.find(
                    //                     (ele) =>
                    //                     ele.CheckOutTime.toDate() >
                    //                     moment(inDay).toDate()
                    //                 )
                    //                 if (findCheckoutInday != undefined) {
                    //                     checkInShow =
                    //                         checkInShow +
                    //                         moment(
                    //                             findCheckoutInday.CheckOutTime.toDate()
                    //                         ).format(' - ออก HH:mm') +
                    //                         txtShowOutAuto

                    //                     if (findCheckoutInday.ForgetCheckOut != undefined) {
                    //                         checkInShow = 'ขาด(ลืมเช็คเอ้าท์)'
                    //                     }
                    //                 }
                    //             } else {
                    //                 checkInShow =
                    //                     checkInShow +
                    //                     moment(
                    //                         findedCheckOut.CheckOutTime.toDate()
                    //                     ).format(' - ออก HH:mm') +
                    //                     // moment(filteredCheckOut[0].CheckOutTime.toDate()).format(' - ออก HH:mm') +
                    //                     txtShowOutAuto
                    //                 if (findedCheckOut.ForgetCheckOut != undefined) {
                    //                     checkInShow = 'ขาด(ลืมเช็คเอ้าท์)'
                    //                 }
                    //             }
                    //         }
                    //     } else {
                    //         //ถ้ามีเช็คเอ้าแล้วไม่มีกะ แต่ต้องมีเช็คอินถึงจำเอ้าค่าเช็คเอ้ามาโชว์
                    //         if (finded != undefined) {
                    //             //กรณีมีเช็คอิน
                    //             checkInShow =
                    //                 checkInShow +
                    //                 moment(
                    //                     findedCheckOut.CheckOutTime.toDate()
                    //                 ).format(' - ออก HH:mm') +
                    //                 // moment(filteredCheckOut[0].CheckOutTime.toDate()).format(' - ออก HH:mm') +
                    //                 txtShowOutAuto

                    //             if (findedCheckOut.ForgetCheckOut != undefined) {
                    //                 checkInShow = 'ขาด(ลืมเช็คเอ้าท์)'
                    //             }
                    //         }
                    //     }
                    // } else {
                    //     if (shiftHave == true) {
                    //         if (
                    //             findedCheckOutTomorrow != undefined &&
                    //             findedShitf.ShiftDetail.TypeShift == '1'
                    //         ) {
                    //             checkInShow =
                    //                 checkInShow +
                    //                 moment(
                    //                     findedCheckOutTomorrow.CheckOutTime.toDate()
                    //                 ).format(' - ออก HH:mm')

                    //             if (findedCheckOutTomorrow.ForgetCheckOut != undefined) {
                    //                 checkInShow = 'ขาด(ลืมเช็คเอ้าท์)'
                    //             }
                    //         }
                    //     }
                    // }

                    // if (filteredCheckOut.length > 1) {
                    //     filteredCheckOut = filteredCheckOut.filter(
                    //         (ele) =>
                    //         ele.CheckOutTime.toDate() >
                    //         filtered[0].CheckInTime.toDate()
                    //     )

                    //     filteredCheckOut = filteredCheckOut.sort((a, b) => {
                    //         return b.CheckOutTime - a.CheckOutTime
                    //     })
                    // }

                    //กรณีใน 1 วัน มีเช็คอินเอ้า หลายครั้ง
                    // if (filtered.length > 1) {
                    //     // if (item.User_ID == '7hJMvH9g67m0X2uj6LHG' && moment(currentMomentPeruser).format('DD-MM-YYYY') == '24-03-2022') {
                    //     //         console.error('เข้าลูป');
                    //     //         console.error('In มากกว่า 1', (filtered[0].CheckInTime.toDate()), (filtered[1].CheckInTime.toDate()));
                    //     // }
                    //     // console.log('filteredCheckOut', filteredCheckOut)
                    //     // console.log('filteredCheckOut', filteredCheckOut.length)

                    //     var _checkInIndex = filteredCheckOut.length - 1
                    //     checkInShow = ''

                    //     filtered.forEach((_checkIn) => {
                    //         let _tmpCheckInOut = moment(
                    //             _checkIn.CheckInTime.toDate()
                    //         ).format('เข้า HH:mm ')

                    //         // console.warn('filteredCheckOut', filteredCheckOut.length , filtered.length);

                    //         if (filteredCheckOut[_checkInIndex] != undefined) {
                    //             _tmpCheckInOut +=
                    //                 moment(
                    //                     filteredCheckOut[
                    //                         _checkInIndex
                    //                     ].CheckOutTime.toDate()
                    //                 ).format(' - ออก HH:mm') + '\n'
                    //         }
                    //         checkInShow += _tmpCheckInOut
                    //         _checkInIndex--

                    //         // console.warn('checkInShow', checkInShow)
                    //         // console.warn(
                    //         //   'shiftHave',
                    //         //   shiftHave
                    //         // )

                    //         // if(shiftHave == true){
                    //         //   // console.warn('findedCheckOutTomorrow', moment(_checkIn.CheckInTime.toDate()).format('เข้า HH:mm '));
                    //         //   // findedShitf.ShiftDetail.TypeShift
                    //         //   // console.warn('findedShitf', findedShitf.ShiftDetail.TypeShift);
                    //         //   if(findedShitf.ShiftDetail.TypeShift == '1'){
                    //         //     // _tmpCheckInOut = moment(_checkIn.CheckInTime.toDate()).format('เข้า HH:mm ')
                    //         //     if(filtered.length == 2 && filteredCheckOut.length == 1){
                    //         //       var nowDate  = moment(currentMomentPeruser).add('days', 1)
                    //         //       console.warn('nowDate', nowDate.toDate());
                    //         //       var timeSiftAddDays = checkOut.find((ele) => moment(ele.CheckOutTime.toDate()).format('YYYY-MM-DD') == moment(nowDate).format('YYYY-MM-DD'))

                    //         //       // console.warn('timeSiftAddDays', timeSiftAddDays.length);
                    //         //       // console.warn('currentMomentPeruser', moment(timeSiftAddDays[]).format('YYYY-MM-DD'));
                    //         //     }
                    //         //   }
                    //         // }
                    //     })
                    // }

                    //นับวันหยุดประจำสัปดาห์ว่ากี่วัน
                    var _tmpThisWeekend = false
                    if (
                        profiledata.Weeked.Mon == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Mon'
                    ) {
                        _tmpThisWeekend = true
                            //jak ตัดการนับวันหยุดประจำสัปดาห์ออก แล้วเอาไปนับด้านล่างแทน
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Tue == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Tue'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Wed == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Wed'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Thu == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Thu'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Fri == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Fri'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Sat == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Sat'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }
                    if (
                        profiledata.Weeked.Sun == 1 &&
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('ddd') == 'Sun'
                    ) {
                        _tmpThisWeekend = true
                            // item['CountDateWeekend']++
                    }



                    //นับจำนวนวันทำงานทั้งหมด หักวันหยุดประจำสัปดาห์ และวันหยุดพิเศษ
                    var _tmpThisHoliday = false
                    var _findedHolidaData = holidayData.Holiday.find(
                        (ele) =>
                        ele ==
                        moment(currentMomentPeruser)
                        .locale('en')
                        .format('YYYY-MM-DD')
                    )
                    if (_findedHolidaData != undefined) {
                        //ถ้าวันนี้ที่วนเป็นวันหยุดพิเศษ
                        _tmpThisHoliday = true
                    }
                    if (_tmpThisWeekend) {
                        // showDataSummary.WeekendCount++
                    }
                    if (_tmpThisHoliday) {
                        showDataSummary.HolidayCount++
                    }

                    if (
                        _tmpThisWeekend == false &&
                        _tmpThisHoliday == false
                    ) {
                        //นับวันทำงาน
                        showDataSummary.WorkDaySum++
                    }

                    //เช็คว่าลาหรือไม่
                    var findedLeave = leaveDoc.find(
                        (ele) =>
                        moment(currentMomentPeruser).isBetween(
                            moment(ele.StartDateTime.toDate()).format(
                                'YYYY-MM-DD'
                            ),
                            moment(ele.EndDateTime.toDate()).format(
                                'YYYY-MM-DD'
                            )
                        ) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') ==
                        moment(ele.StartDateTime.toDate()).format(
                            'YYYY-MM-DD'
                        ) ||
                        moment(currentMomentPeruser).format('YYYY-MM-DD') ==
                        moment(ele.EndDateTime.toDate()).format(
                            'YYYY-MM-DD'
                        )
                    )

                    // console.log('findedLeave', findedLeave);
                    if (findedLeave != undefined) {
                        item['CountLeave']++
                            //ถ้าวันนี้ในคอลัมถ์เป็นลา
                            item['CheckIn' + currentMomentPeruser] =
                            findedLeave.LeaveTypeData.Name + ' (' + Math.abs(findedLeave[findedLeave.TypeLeaveDocID]) + ' วัน) \n' +
                            '(' + moment(findedLeave.StartDateTime.toDate()).locale('th').format('DD MMM') + ' - ' + moment(findedLeave.EndDateTime.toDate()).locale('th').format('DD MMM') + ')'
                            //ถ้ามีลาแล้วมีเช็คอินในวันให้ลบวันมาทำงาน 1 วัน
                        if (finded != undefined) {
                            item['CountDateCheckIn']--
                                var _diffLeave = timediff(
                                        findedLeave.StartDateTime.toDate(),
                                        findedLeave.EndDateTime.toDate(),
                                        'Hm'
                                    )
                                    // console.log(
                                    //     '_diffLeave',
                                    //     _diffLeave.hours,
                                    //     _diffLeave.minutes
                                    // )
                            var _tmpLeaveHour = ''
                            if (_diffLeave.hours < 9) {
                                _tmpLeaveHour =
                                    '' +
                                    _diffLeave.hours +
                                    '.' +
                                    _diffLeave.minutes +
                                    ' ชม.' +
                                    '\n'
                            }

                            if (_tmpCheckLate == true) {
                                //ถ้าเข้าสายและลาด้วย ให้หักจำนวนวันมาสายออก และหักจำนวนนาที ที่มาสายรวมไว้ออก
                                item['CountLate']--
                                    item['SumLateTime'] -= Number(finded.LateTimeMinite)

                                // item['CheckIn' + currentMomentPeruser] =
                                //     findedLeave.LeaveTypeData.Name +
                                //     ' ' +
                                //     _tmpLeaveHour +
                                //     checkInShow

                            }
                        }
                    } else {
                        //ถ้าไม่ใช่ลา
                        // item['CheckIn' + currentMomentPeruser] =
                        //     shifAndJobTxt + lateTxt + checkInShow
                        // if (_tmpThisWeekend == false && checkInShow == '-') {
                        //     //ถ้าเป็นวันทำงานปกติ
                        //     item['CheckIn' + currentMomentPeruser] = 'ขาด'
                        //     item['CountNotWork']++
                        // }
                    }

                    // if (finded == undefined) {
                    //     //ถ้าไม่มีเวลาเช็คอินท์ ให้ตรวจสอบว่ามีกะหรือไม่ ถ้ามีกะจะได้แสดงในรีพอร์ทว่าขาด
                    //     var findedShitf2 = employeeShitfDoc.find(
                    //         (ele) =>
                    //         ele.Day ==
                    //         moment(currentMomentPeruser).format('YYYY-MM-DD')
                    //     )

                    //     if (
                    //         findedShitf2 != undefined &&
                    //         findedLeave == undefined
                    //     ) {
                    //         //แต่ข้อมูลวันนี้เป็นกะ และไม่ได้ลา
                    //         item['CheckIn' + currentMomentPeruser] = 'ขาด'
                    //         item['CountNotWork']++

                    //     }
                    // }

                    // //เช็คว่าเป็นวันหยุดพิเศษไหม
                    // var _findedHolidaData = holidayData.Holiday.find(
                    //         (ele) =>
                    //         ele ==
                    //         moment(currentMomentPeruser)
                    //         .locale('en')
                    //         .format('YYYY-MM-DD')
                    //     )
                    //     //ถ้าเป็นวันหยุดพิเศษ
                    // if (_findedHolidaData != undefined) {
                    //     //ถ้าได้ค่ามาเป็น ขาด แสดงว่าวันหยุดพิเศษไม่ได้มีการเช็คอิน เอ้าท์
                    //     if (item['CheckIn' + currentMomentPeruser] == 'ขาด') {
                    //         item['CheckIn' + currentMomentPeruser] = '-'
                    //         item['CountNotWork']--
                    //     }
                    //     //ถ้าไม่ได้ค่ามาเป็นขาด ให้แสดงตามค่าที่ได้มา
                    // }

                    item['CurrentMomentPeruser'] = '' + currentMomentPeruser

                    //หาชม.โอที ในแต่ละวัน
                    // if (otDoc.length > 0) {
                    //     var _findedOtData = otDoc.find(
                    //         (ele) =>
                    //         moment
                    //         .tz(ele.StartDateTime.toDate(), 'Asia/Bangkok')
                    //         .format('YYYY-MM-DD') ==
                    //         moment(currentMomentPeruser)
                    //         .locale('en')
                    //         .format('YYYY-MM-DD')
                    //     )
                    //     if (_findedOtData != undefined) {
                    //         // console.log('_findedOtData', _findedOtData)
                    //         item['CountOt']++
                    //             item['SumOtHour'] += Number(_findedOtData.OT_Hour)
                    //         item['CheckIn' + currentMomentPeruser] =
                    //             item['CheckIn' + currentMomentPeruser] +
                    //             ' \n(OT ' +
                    //             Number(_findedOtData.OT_Hour).toFixed(2) +
                    //             ' ชม.)'
                    //     }
                    // }
                    //jak เปลี่ยนให้นับวันหยุดประจำสัปดาห์จาก '-' แทน
                    // if (item['CheckIn' + currentMomentPeruser] == '-') {
                    //     item['CountDateWeekend']++
                    //         showDataSummary.WeekendCount++
                    // }
                    // if (checkInShow == 'ขาด(ลืมเช็คเอ้าท์)') {
                    //     item['CheckIn' + currentMomentPeruser] = 'ขาด(ลืมเช็คเอ้าท์)'
                    //     item['CountNotWork']++
                    // }

                    // if (item.User_ID == '7hJMvH9g67m0X2uj6LHG') {
                    //     console.error('จบลูป ', moment(currentMomentPeruser).format('DD-MM-YYYY'));
                    // }

                    currentMomentPeruser.add(1, 'days')
                } //จบ วนคอลัมถ์วันที่เพื่อแสดงผล

                if (item['CountOt'] > 0) {
                    showDataSummary.OtCountPeople++
                        // console.log("item['SumOtHour'] ", item['SumOtHour'])
                        // console.log("item['CountOt'] ", item['CountOt'])

                        showDataSummary.OtHour +=
                        Number(item['SumOtHour']) / Number(item['CountOt'])
                }

                if (item['CountLeave'] > 0) {
                    //นับว่าลากี่คน
                    showDataSummary.LeaveCountPeople++
                        showDataSummary.LeaveDaySum += item['CountLeave'];
                }

                if (item['CountNotWork'] > 0) {
                    //นับว่าขาดงานกี่คน
                    showDataSummary.MissingCountPeople++
                }

                if (item['SumLateTime'] > 0) {
                    //นับว่าสายกี่คน
                    showDataSummary.LateCountPeople++
                        //หาค่าเฉลี่ยว่าสายกี่นาทีต่อคน แล้วค่อยเอาต่อคนไปหาเฉลี่ยต่อยอดรวมทั้งหมด
                        showDataSummary.SumLateMinite +=
                        Number(item['SumLateTime']) / Number(item['CountLate'])
                }
            }
            await db.collection(compId + 'User').doc(item['docId']).update({
                'LateTime': Number(item['CountLate']),
            });
            console.log("item['Fullname']", item['Fullname']);
            console.log('CountLate', item['CountLate'])
        }
        // AvgLeave
        // AvgLate


        iuser++;
    } //จบวนรายพนักงาน
    await db.collection('CompanyCode').doc(compId + '').update({
        'AvgLate': Number(showDataSummary.SumLateMinite),
        'AvgLeave': Math.ceil(Number(showDataSummary.LeaveDaySum / iuser)),
    });
    // } //จบวนรายบริษัท
    // });
    // res.send('CountLate');
    return 'CountLate'
});

// exports.taskRunner = functions.https.onCall(async (data, context) => { ///ใช้รัน offline
exports.taskRunner = functions.runWith({timeoutSeconds: 300, memory: '1GB',}).pubsub.schedule("*/5 * * * *").timeZone('Asia/Bangkok').onRun(async(context) => {
    // exports.taskRunner = functions
    //     .runWith({
    //         timeoutSeconds: 300,
    //         memory: '1GB',
    //     })
    
    //     .https.onRequest(async(req, res) => {
    var now = moment().tz('Asia/Bangkok')
    var now_date = now.format('YYYY-MM-DD')
    var now_time = now.format('HH:mm:ss')
    var nowDate = now.toDate();
    // var nowDate = moment
    //     .tz('2022-02-10' + ' ' + '23:59:59', 'Asia/Bangkok')
    //     .toDate()
    console.log('taskRunner ', nowDate)
        // console.log('now_date', now_date)
    var resSnapshot = await db
        .collection('Task')
        // .where('performAt', '<=', nowDate)
        .where('status', '==', 'schedule')
        .get()
    var filterResSnapshot = resSnapshot.docs.filter((ele) => ele.data().performAt.toDate() <= nowDate)
    console.log('filterResSnapshot.length', filterResSnapshot.length)
    if (filterResSnapshot.length > 0) {
        for (const doc of filterResSnapshot) {
            var task = doc.data()
            // console.warn('task', task);
            var compId = task.compId
            var performAt = task.performAt
            var standardProfileID = task.standardProfileID
            var status = task.status
            var task_id = doc.id
                // console.log('compId', compId);
                // console.log('standardProfileID', standardProfileID);
            var resStandardProfile = await db
                .collection(compId + 'StandardProfile')
                .doc(standardProfileID)
                .get()
            var standardProfile = resStandardProfile.data()
            console.log('standardProfile', standardProfile);
            //ถ้ามีการลบกลุ่มพนักงานออกไปไม่ต้องทำการเช็ค auto check out
            if (standardProfile != undefined) {
                console.log('standardProfile', standardProfile);
                var autoTimeOut = standardProfile.AutoTimeOut
                var useAutoCheckOut = standardProfile.UseAutoCheckOut
                    console.log('useAutoCheckOut', useAutoCheckOut);
                    console.log('autoTimeOut', autoTimeOut);

                if (useAutoCheckOut != undefined) {
                    //ถ้าตั้งใช้เวลาออกงานอัตโนมัติ แต่ไม่ได้ตั้งเวลาออกงานอัตโนมัติไว้ ให้ไปเอาเวลาออกงานที่ตั้งไว้ของกลุ่มมาใช้แทน
                    autoTimeOut = autoTimeOut == undefined ? standardProfile.TimeOut : autoTimeOut
                        //ดึงพนักงานที่อยู่ในกลุ่ม
                    var resUser = await db
                        .collection(compId + 'User')
                        .where('Profile_ID', '==', standardProfileID)
                        .get()
                    console.log('>>>>>', resUser.docs.length);
                    if (resUser.docs.length > 0) {
                        for (const docUser of resUser.docs) {
                            var _docUser = docUser.data()
                            console.log('_docUser', _docUser);
                                //หาว่าทำโอทีหรือไม่
                            var resHistoryOT = await db
                                .collection(compId + 'HistoryOT')
                                .where('User_ID', '==', _docUser.User_ID)
                                .get()
                                console.log('resHistoryOT', resHistoryOT);
                            var resCheckIn = await db
                                .collection(compId + 'CheckIn')
                                .doc(_docUser.User_ID)
                                .get()
                                console.log('resCheckIn', resCheckIn);
                            var resCheckOut = await db
                                .collection(compId + 'CheckOut')
                                .doc(_docUser.User_ID)
                                .get()
                                console.log('resCheckOut', resCheckOut);
                            var checkOut = []

                            if (resCheckOut.exists) {
                                checkOut = resCheckOut.data()
                            }
                            if (resCheckIn.exists) {
                                
                                var checkIn = resCheckIn.data()
                                var filtedCheckIn = []
                                if (checkIn.CheckIn.length > 0) {
                                    filtedCheckIn = checkIn.CheckIn.filter((checkIn) => moment.tz(checkIn.CheckInTime.toDate(), 'Asia/Bangkok').isSame(nowDate, 'date'))
                                }
                                var filtedCheckOut = []
                                if (checkOut.CheckOut.length > 0) {
                                    filtedCheckOut = checkOut.CheckOut.filter((checkOut) => moment.tz(checkOut.CheckOutTime.toDate(), 'Asia/Bangkok').isSame(nowDate, 'date'))
                                }
                                
                                var filtedHistoryOT = []
                                if (resHistoryOT.docs.length > 0) {
                                    
                                    filtedHistoryOT = resHistoryOT.docs.filter((historyOT) => {
                                        var endDateTime = historyOT.data().EndDateTime
                                        if (endDateTime != null) {
                                            return (moment.tz(endDateTime.toDate(), 'Asia/Bangkok').isSame(nowDate, 'date') && historyOT.data().Status == 1)
                                        } else {
                                            // console.log('filtedHistoryOT', compId, historyOT.data());
                                            return false
                                        }
                                    })
                                }
                                
                                if (filtedHistoryOT.length > 0) {
                                    // console.log('filtedHistoryOT', filtedHistoryOT.length);
                                    filtedHistoryOT = filtedHistoryOT.sort((a, b) => {
                                        return moment(a.data().EndDateTime.toDate()).diff(moment(b.data().EndDateTime.toDate()))
                                    })
                                    var historyOT = filtedHistoryOT[0].data()
                                    var endDateTimeOT = historyOT.EndDateTime
                                        //ถ้าเวลาออกงานโอทีมากกว่าเวลาออกงานอัตโนมัติให้เอาเวลาออกงานแสตมป์อัตโนมัติมาใช้
                                        // console.log('endDateTimeOT.toDate()', endDateTimeOT.toDate());
                                        // console.log('autoTimeOut', autoTimeOut);
                                    diff = moment(endDateTimeOT.toDate()).diff(moment.tz(now_date + ' ' + autoTimeOut, 'Asia/Bangkok'), 'minutes')
                                    console.log('diff', diff)
                                    if (diff > 0) {
                                        //ถ้าเวลาเลิกโอทีมากกว่าเวลาออกงาน แต่ถ้าไม่ก็ให้ใช้เวลาออกงานอัตโนมัติ
                                        autoTimeOut = moment.tz(endDateTimeOT.toDate(), 'Asia/Bangkok').format('HH:mm')
                                    }
                                }
                                // console.log('>>>>>>>>>>>>');
                                //ถ้า length checkIn > checkOut คือยังไม่มีเช็คเอ้าออก
                                var InMoreOut = filtedCheckIn.length - filtedCheckOut.length
                                // console.warn('InMoreOut', InMoreOut);
                                if (InMoreOut > 0) {
                                    // console.log(compId + 'filtedCheckIn', filtedCheckIn.length, filtedCheckIn)
                                    // console.log(compId + 'filtedCheckOut',filtedCheckOut.length)
                                    for (var i = 0; i < InMoreOut; i++) {
                                        if (filtedCheckIn[i].CheckInTime != null) {
                                            now_date = moment.tz(filtedCheckIn[i].CheckInTime.toDate(), 'Asia/Bangkok').format('YYYY-MM-DD')
                                            console.log('now_date', now_date)

                                            var checkOutTime = moment.tz(now_date + ' ' + autoTimeOut, 'Asia/Bangkok').toDate()

                                            var checkOutData = {
                                                    CheckOutTime: checkOutTime,
                                                    CreatedOn: moment().tz('Asia/Bangkok').toDate(),
                                                    CurrentLat: 0.0,
                                                    CurrentLong: 0.0,
                                                    ImageSelfie: '',
                                                    QRCodeName: 'อัตโนมัติ',
                                                    QRCode_ID: '',
                                                    User_ID: _docUser.User_ID,
                                                }
                                                // console.log('checkOutData', checkOutData)

                                            await db.collection(compId + 'CheckOut').doc(_docUser.User_ID).update({
                                                CheckOut: FieldValue.arrayUnion(checkOutData),
                                            })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                //อัพเดทว่าทำauto checkOut ของกลุ่มพนักงานนี้ไปแล้ว
                doc.ref.update({ status: 'complete', updatedAt: nowDate })
                    //ถ้าตรวจสอบว่ายังใช้ auto checkout อยู่หรือไม่ ถ้าไม่จะดึงค่า document นี้ไม่ได้
                    // console.log('%%%%%%%', compId, standardProfileID);
                var resAutoCheckOut = await db
                    .collection('AutoCheckOut')
                    .doc(compId + '_' + standardProfileID)
                    .get()
                    console.log('จำนวน');
                if (resAutoCheckOut.exists) {
                    //ถ้าใช้งานอยู่จะทำการ เพิ่ม Task เพื่อรัน auto checkOut วันพรุ่งนี้
                    // get tomorrow date and set time
                    var tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
                        // var tomorrow = moment().format('YYYY-MM-DD')
                    console.log('พรุ่งนี้');
                    var docAutoCheckOut = resAutoCheckOut.data()
                    var resCheckHaveTaskAdd = await db
                        .collection('Task')
                        // .where('performAt', '>=', tomorrow)
                        .where('status', '==', 'schedule')
                        .get()
                        var filterResResCheckHaveTaskAdd = resCheckHaveTaskAdd.docs.filter((ele) => ele.data().performAt.toDate() >= tomorrow)   
                    console.log('resCheckHaveTaskAdd.docs.length', filterResResCheckHaveTaskAdd.length);
                    if (filterResResCheckHaveTaskAdd.length == 0) {
                        var addTask = {
                            compId: compId,
                            performAt: moment.tz(tomorrow + ' ' + docAutoCheckOut.Time, 'Asia/Bangkok').toDate(),
                            status: 'schedule',
                            standardProfileID: standardProfileID,
                        }
                        console.log('addTask', addTask)
                        await db.collection('Task').add(addTask);
                    }

                }
            }
        }
    }

    // // TaskJob อัพเดท สเตตัสจ๊อป อัตโนมัติ
    // var resSnapshotJob = await db
    //     .collection('TaskJob')
    //     // .where('performAt', '<=', nowDate)
    //     .where('status', '==', 'schedule')
    //     .get()
    // var filterResSnapshotJob = resSnapshotJob.docs.filter((ele) => ele.data().performAt.toDate() <= nowDate)
    // console.log('filterResSnapshotJob', filterResSnapshotJob);    
    // if (filterResSnapshotJob.length > 0) {
    //     for (const _doc of filterResSnapshotJob) {
    //         var task = _doc.data()
    //         var compId = task.compId
    //         var performAt = task.performAt
    //         var docJobID = task.jobAnnouncementID
    //         var status = task.status
    //         var task_id = _doc.id
    //         await db.collection(compId + 'JobAnnouncement').doc(docJobID).update({ Status: 3 })
    //         _doc.ref.update({ status: 'complete', updatedAt: nowDate })
    //     }
    // }

    // return "success";
})



