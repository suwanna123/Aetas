const functions = require("firebase-functions");

const admin = require('firebase-admin')
const FieldValue = admin.firestore.FieldValue
var moment = require('moment-timezone')
var timediff = require('timediff')
admin.initializeApp({ credential: admin.credential.applicationDefault() })
var db = admin.firestore()

exports.CountLate = functions.runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).https.onRequest(async(req, res) => {
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
    let compId = req.body.compId;
    console.log('compId', compId);
    var profiledataRef = await db.collection(compId + 'StandardProfile').get();
    let profiledataAll = profiledataRef.docs.map(doc => doc.data());

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
                profiledata,
                compId,
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
    res.send('CountLate');
});

async function getCheckIn(userId, profiledata, compId, selectStartDate, selectEndDate) {
    // console.log('profiledata', profiledata);
    return new Promise((resolve) => {
        db.collection(compId + 'CheckIn')
            .doc(userId)
            .get()
            .then((doc) => {
                var result = []
                if (doc.exists) {
                    // console.log('doc.data().CheckIn.length', doc.data().CheckIn.length);
                    if (doc.data().CheckIn.length > 0) {
                        var dataForLoop = []
                        var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                        var endDate = moment(selectEndDate).add(1, 'day') //วันสินสุด +1 วัน เป็นตัวกรอง
                        dataForLoop = doc
                            .data()
                            .CheckIn.filter(
                                (ele) =>
                                moment(ele.CheckInTime.toDate()).isAfter(startDate) &&
                                moment(ele.CheckInTime.toDate()).isBefore(endDate)
                            )

                        dataForLoop = dataForLoop.sort((a, b) => {
                            return a.CheckInTime.toDate() - b.CheckInTime.toDate()
                        })

                        // console.log('dataForLoop', dataForLoop)

                        for (let ele of dataForLoop) {
                            // console.log('ss', moment(ele.CheckInTime.toDate()).format('YYYY-MM-DD'));
                            //เช็คว่าถ้ามีเช็คอินซ้ำในวันให้เอาเวลาที่เข้างานแรกสุดมาแสดง
                            var finded = result.find(
                                (res) =>
                                moment(res.CheckInTime.toDate()).format('YYYY-MM-DD') ==
                                moment(ele.CheckInTime.toDate()).format('YYYY-MM-DD')
                            )

                            if (finded == undefined) {

                                //เช็คว่าใช้เงื่อนไขเข้างานสายหรือไม่

                                if (profiledata.UseTimeLateMinite != undefined) {
                                    if (profiledata.UseTimeLateMinite == '1') {
                                        //ถ้าเป็น 1 คือนับเวลามาสาย
                                        var timeLate = profiledata.TimeLate //เริ่มนับเวลามาสายที่นาทีเท่าไหร่
                                        var timeIn = profiledata.TimeIn //เวลาเข้างาน
                                            // res.CheckInTime.toDate()
                                            // console.log('TimeIn', moment((moment(ele.CheckInTime.toDate()).format('YYYY-MM-DD') + ' ' + timeIn)));
                                            // console.log('TimeIn', moment(moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss')));

                                        var _diff = timediff(
                                            moment(
                                                moment(ele.CheckInTime.toDate()).format(
                                                    'YYYY-MM-DD'
                                                ) +
                                                ' ' +
                                                timeIn
                                            ),
                                            moment(moment(ele.CheckInTime.toDate()).tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss')),
                                            'ms'
                                        )

                                        // console.log('_diff', _diff, timeLate);
                                        if (_diff.minutes > timeLate) {
                                            // console.log('_diff', _diff);
                                            ele['LateCount'] = 1
                                            ele['LateTimeMinite'] = _diff.minutes
                                        }
                                    }
                                }
                                //ถ้าไม่มีเช็คอินซ้ำให้นำข้อมูลไปแสดงได้เลย
                            }
                            result.push(ele)
                        }
                        // console.log('result', result)
                        resolve(result)
                    } else {
                        resolve(result)
                    }
                } else {
                    resolve(result)
                }
            })
    })
}

async function getCheckOut(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db
            .collection(compId + 'CheckOut')
            .doc(userId)
            .get()
            .then((doc) => {
                var result = []
                if (doc.exists) {
                    if (doc.data().CheckOut.length > 0) {
                        var dataForLoop = []
                        var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                        var endDate = moment(selectEndDate).add(1, 'day') //วันสินสุด +1 วัน เป็นตัวกรอง
                        dataForLoop = doc
                            .data()
                            .CheckOut.filter(
                                (ele) =>
                                moment(ele.CheckOutTime.toDate()).isAfter(startDate) &&
                                moment(ele.CheckOutTime.toDate()).isBefore(endDate)
                            )
                        dataForLoop = dataForLoop.sort((a, b) => {
                            return a.CheckOutTime.toDate() - b.CheckOutTime.toDate()
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
                } else {
                    resolve(result)
                }
            })
    })
}

async function getLeave(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db
            .collection(compId + 'TypeLeave')
            .get()
            .then((docTypes) => {
                var typeLeave = []
                docTypes.docs.forEach((docType) => {
                        typeLeave.push(docType.data())
                    })
                    // console.log('userId', userId)
                db
                    .collection(compId + 'Leave')
                    .where('User_ID', '==', userId)
                    .where('Status', '==', 1)
                    .get()
                    .then((querySnapshot) => {
                        var result = []
                        var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                        var endDate = moment(selectEndDate).add(1, 'day') //วันสิ้นสุด +1 วัน เป็นตัวกรอง
                            // console.log(
                            //     'querySnapshot.docs.length',
                            //     querySnapshot.docs.length
                            // )
                        if (querySnapshot.docs.length > 0) {
                            querySnapshot.docs.forEach((doc) => {
                                var _doc = doc.data()
                                var finded = typeLeave.find(
                                    (ele) => ele.ID == _doc.TypeLeaveDocID
                                )
                                _doc['LeaveTypeData'] = { Name: '' }
                                if (finded != undefined) {
                                    _doc['LeaveTypeData'] = finded
                                }
                                if (
                                    moment(_doc.StartDateTime.toDate()).isAfter(startDate) &&
                                    moment(_doc.StartDateTime.toDate()).isBefore(endDate)
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
    })
}

async function getEmployeeShitf(userId, compId, selectStartDate, selectEndDate) {
    // console.log('getEmployeeShitfuserId', userId)
    return new Promise((resolve) => {
        db
            .collection(compId + 'EmployeeShift')
            .doc(userId)
            .get()
            .then(async(querySnapshot) => {
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

async function getLate(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db
            .collection(compId + 'Late')
            .where('User_ID', '==', userId)
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

async function getOT(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db
            .collection(compId + 'HistoryOT')
            .where('User_ID', '==', userId)
            .get()
            .then((querySnapshot) => {
                var result = []
                var startDate = moment(selectStartDate).subtract(1, 'day') //วันเริ่มต้น -1 วัน เป็นตัวกรอง
                var endDate = moment(selectEndDate).add(1, 'day') //วันสิ้นสุด +1 วัน เป็นตัวกรอง
                if (querySnapshot.docs.length > 0) {
                    querySnapshot.docs.forEach((doc) => {
                        var _doc = doc.data()
                        if (_doc.Status == 1) {
                            if (
                                moment(_doc.StartDateTime.toDate()).isAfter(startDate) &&
                                moment(_doc.EndDateTime.toDate()).isBefore(endDate)
                            ) {
                                var diff = moment
                                    .tz(_doc.EndDateTime.toDate(), 'Asia/Bangkok')
                                    .diff(
                                        moment.tz(_doc.StartDateTime.toDate(), 'Asia/Bangkok'),
                                        'hours',
                                        true
                                    )
                                _doc['OT_Hour'] = diff
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

async function getJob(userId, compId, selectStartDate, selectEndDate) {
    return new Promise((resolve) => {
        db
            .collection(compId + 'JobAnnouncement')
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